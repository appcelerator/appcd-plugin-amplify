import AmplifyServiceDispatcher from './amplify-service-dispatcher';
import prettyMs from 'pretty-ms';
import { DataServiceDispatcher } from 'appcd-dispatcher';

const { highlight } = appcd.logger.styles;

const refreshLogger = appcd.logger('refresh');
const statusLogger = appcd.logger('status');

/**
 * Defines the service endpoints for the AMPLIFY Platform authentication related functions.
 */
export default class AuthService extends AmplifyServiceDispatcher {
	/**
	 * Interval timer for displaying the refresh status for every authenticated account.
	 * @type {Timer}
	 */
	statusTimer = null;

	/**
	 * A map of active access token refresh timers.
	 * @type {Object}
	 */
	refreshTimers = {};

	/**
	 * Wires up the AMPLIFY Platform authentication service endpoints.
	 *
	 * @param {AmplifySDK} sdk - The AMPLIFY SDK instance.
	 * @param {Config} amplifyConfig - The AMPLIFY CLI config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(sdk, amplifyConfig) {
		await super.activate(sdk, amplifyConfig);

		// initialize the list of accounts
		const authAccountService = new DataServiceDispatcher(this.processAccounts(await this.sdk.auth.list()), '');

		// sadly, we can't rely on watching the token store file to refresh the accounts, so after
		// a successful login, logout, or switch, we manually refresh the list of accounts
		const updateAccountsData = async accounts => {
			authAccountService.setData(this.processAccounts(accounts || (await this.sdk.auth.list())));
		};

		// currently, we do not support if the `auth.tokenStoreDir` or `auth.tokenStoreType`
		// AMPLIFY CLI config values change while the AMPLIFY plugin is running.
		// `auth.tokenStoreDir` is undocumented and `auth.tokenStoreType` should always be file
		// based, so we're just gonna roll with it.
		const tokenStoreFile = this.sdk.client.tokenStore?.tokenStoreFile;

		if (tokenStoreFile) {
			console.log(`Watching token store file: ${highlight(tokenStoreFile)}`);
			appcd.fs.watch({
				debounce: 2345,
				handler: async () => {
					const accounts = await this.sdk.auth.list();
					const watching = new Set(Object.keys(this.refreshTimers));

					await updateAccountsData(accounts);

					for (const account of accounts) {
						watching.delete(account.name);
						this.refreshToken(account);
					}

					for (const name of watching) {
						console.warn(`Removing orphan refresh timer for account "${name}"`);
						clearTimeout(this.refreshTimers[name].handle);
						delete this.refreshTimers[name];
					}
				},
				paths: [ tokenStoreFile ],
				type: 'amplify-auth-accounts'
			});
		}

		this.register('/', authAccountService);

		this.register('/active', () => authAccountService.data.find(a => a.active) || null);

		this.register('/login', async ctx => {
			const { data } = ctx.request;
			const opts = {
				force: data?.force
			};

			if (data) {
				for (const prop of [ 'baseUrl', 'clientId', 'clientSecret', 'env', 'password', 'realm', 'secretFile', 'serviceAccount', 'username' ]) {
					opts[prop] = data[prop];
				}
			}

			let account;
			try {
				account = await this.sdk.auth.login(opts);
			} catch (err) {
				if (err.account && err.code === 'EAUTHENTICATED') {
					console.log('Account already authenticated');
					({ account } = err);
				} else {
					throw err;
				}
			}
			this.refreshToken(account);

			if (!amplifyConfig.get(`auth.defaultOrg.${account.hash}`)) {
				amplifyConfig.set(`auth.defaultOrg.${account.hash}`, account.org.guid);
				amplifyConfig.save();
			}

			await updateAccountsData();

			ctx.response = account;
		});

		this.register('/logout/:accountName?', async ctx => {
			const { data, params } = ctx.request;
			const accountName = params?.accountName || data?.accountName;
			const opts = {};

			if (accountName) {
				opts.accounts = [ accountName ];
			} else {
				opts.all = true;
			}

			await updateAccountsData();

			ctx.response = await this.sdk.auth.logout(opts);
		});

		this.register('/server-info', async ctx => {
			ctx.response = await this.sdk.auth.serverInfo();
		});

		this.register('/switch/:accountName?/:org?', async ctx => {
			const { data, params } = ctx.request;
			const accounts = await this.sdk.auth.list();
			const accountName = params?.accountName || data?.accountName;
			const orgId = params.org || data.org;

			if (!accounts.length) {
				throw new Error('No authenticated accounts found');
			}

			let account = accounts.find(a => a.name === accountName);
			if (!account) {
				throw new Error(`Account "${accountName}" not found`);
			}

			const org = account.orgs.find(o => o.guid === orgId || o.id === orgId || o.name === orgId);
			if (!org) {
				throw new Error(`Unable to find organization "${orgId}"`);
			}

			if (!account.org || account.org.guid !== org.guid) {
				// need to switch org
				account = await this.sdk.auth.switchOrg(account, org.id);
			}

			amplifyConfig.set('auth.defaultAccount', account.name);
			amplifyConfig.set(`auth.defaultOrg.${account.hash}`, org.guid);
			amplifyConfig.save();

			await updateAccountsData();

			ctx.response = account;
		});

		this.register('/:accountName?', async ctx => {
			ctx.response = await this.getAccount(ctx.request);
		});

		// start the status debug logging for each account
		this.statusTimer = setInterval(async () => {
			if (this.sdk) {
				const accounts = await this.sdk.auth.list();
				const now = Date.now();

				for (const account of accounts) {
					const accessExpiresIn = account.auth.expires.access - now;
					const refreshExpiresIn = account.auth.expires.refresh - now;
					if (this.refreshTimers[account.name] && refreshExpiresIn >= 1000) {
						statusLogger.log(`${highlight(account.name)} access token ${accessExpiresIn < 0 ? 'is expired' : `expires in ${highlight(prettyMs(accessExpiresIn))}`}, refresh token expires in ${highlight(prettyMs(refreshExpiresIn))}`);
					}
				}
			}
		}, 60000);
	}

	/**
	 * Clears all pending access token refresh timers.
	 *
	 * @access private
	 */
	clearRefreshTimers() {
		for (const [ name, obj ] of Object.entries(this.refreshTimers)) {
			clearTimeout(obj.handle);
			delete this.refreshTimers[name];
		}
	}

	/**
	 * Clear any refresh and status timers.
	 *
	 * @access public
	 */
	deactivate() {
		clearInterval(this.statusTimer);
		this.clearRefreshTimers();
	}

	/**
	 * Returns a new array of shallow copied account objects with the default flag set.
	 *
	 * @param {Array.<Object>} accounts - An array of authenticated accounts.
	 * @returns {Array.<Object>} Returns the original array of accounts.
	 * @access public
	 */
	processAccounts(accounts) {
		const defaultAccount = this.amplifyConfig.get('auth.defaultAccount');
		return accounts.map(account => {
			return {
				...account,
				default: account.name === defaultAccount
			};
		});
	}

	/**
	 * Schedules an account to have its access token refreshed.
	 *
	 * @param {Object} account - The account to refresh.
	 * @access private
	 */
	refreshToken(account) {
		if (!account) {
			return;
		}

		const { name } = account;

		if (this.refreshTimers[name]) {
			clearTimeout(this.refreshTimers[name].handle);
			delete this.refreshTimers[name];
		}

		const accessExpiresIn = account.auth.expires.access - Date.now();
		const refreshExpiresIn = account.auth.expires.refresh - Date.now();
		const refreshIn = Math.max(accessExpiresIn, 1);

		if (refreshExpiresIn < 1000) {
			// refresh token is going to exprire before we can do anything about it, so just return and
			// let the account get purged
			refreshLogger.log(`${highlight(name)} not enough time to refresh access token; refresh token expires ${prettyMs(refreshExpiresIn)}`);
			return;
		}

		refreshLogger.log(`Refreshing access token in ${highlight(prettyMs(refreshIn))}`);

		// set a timer to refresh the access token 1 minutes before the refresh token is set to expire
		this.refreshTimers[name] = {
			duration: refreshIn,
			handle: setTimeout(async () => {
				try {
					delete this.refreshTimers[name];
					const updatedAccount = await this.sdk.auth.find(name);
					if (updatedAccount) {
						this.refreshToken(updatedAccount);
					} else {
						refreshLogger.warn(`Refresh timer for account "${name}" was fired too late and token could not be refreshed`);
					}
				} catch (err) {
					refreshLogger.error(err.toString());
				}
			}, refreshIn)
		};
	}

	/**
	 * Set the AMPLIFY SDK instance.
	 *
	 * @param {AmplifySDK} sdk - The AMPLIFY SDK instance.
	 * @access public
	 */
	async setSDK(sdk) {
		this.clearRefreshTimers();

		await super.setSDK(sdk);

		const accounts = await sdk.auth.list();
		for (const account of accounts) {
			this.refreshToken(account);
		}
	}
}
