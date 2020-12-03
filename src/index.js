/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import {
	AmplifySDK,
	buildParams,
	loadConfig,
	locations
} from '@axway/amplify-cli-utils';

import gawk from 'gawk';
import prettyMs from 'pretty-ms';

import { debounce } from 'appcd-util';
import { ServiceDispatcher } from 'appcd-dispatcher';
import { snooplogg } from 'appcd-logger';

const { highlight } = snooplogg.styles;
const { configFile } = locations;

const statusLogger = appcd.logger('status');
const refreshLogger = appcd.logger('refresh');

/**
 * The AMPLIFY CLI config object, not the appcd config. It's a `config-kit` instance.
 * @type {Config}
 */
let amplifyConfig;

/**
 * A map of active access token refresh timers.
 * @type {Object}
 */
const refreshTimers = {};

/**
 * The AMPLIFY SDK instance.
 * @type {AmplifySDK}
 */
let sdk;

/**
 * Displays refresh status for every authenticated account.
 * @type {Timer}
 */
let statusTimer;

/**
 * Tracks authenticated accounts information.
 */
class AuthAccountService extends ServiceDispatcher {
	/**
	 * Initialize the data with an observable array.
	 *
	 * @access public
	 */
	constructor() {
		super('');
		this.data = gawk([]);
	}

	/**
	 * Handle an unsubscribe and stop watching the data.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Function} params.publish - The function used to publish data to a dispatcher client.
	 * This is the same publish function as the one passed to `onSubscribe()`.
	 * @access private
	 */
	destroySubscription({ publish }) {
		gawk.unwatch(this.data, publish);
	}

	/**
	 * Initializes the service data with the list of authenticated accounts, then watches the
	 * token store file for changes.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async init() {
		const accounts = await sdk.auth.list();
		const scrubAccounts = accounts => {
			const defaultAccount = amplifyConfig.get('auth.defaultAccount');
			return accounts.map(account => {
				account.active = account.name === defaultAccount;
				return account;
			});
		};

		this.data = gawk(scrubAccounts(accounts));

		const auth = sdk.client;
		const tokenStoreFile = auth.tokenStore?.tokenStoreFile;

		if (tokenStoreFile) {
			console.log(`Watching token store file: ${highlight(tokenStoreFile)}`);

			const handler = debounce(async () => {
				const accounts = await sdk.auth.list();
				const watching = new Set(Object.keys(refreshTimers));

				gawk.set(this.data, scrubAccounts(accounts));

				for (const account of accounts) {
					watching.delete(account.name);
					refreshToken(account);
				}

				for (const name of watching) {
					console.warn(`Removing orphan refresh timer for account "${name}"`);
					clearTimeout(refreshTimers[name].handle);
					delete refreshTimers[name];
				}
			}, 2345);

			appcd.fs.watch({
				handler,
				paths: [ tokenStoreFile ],
				type: 'amplify-auth-accounts'
			});
		} else if (auth.tokenStore) {
			// probably a "memory" based store
			console.warn('Token store is not file-based, unable to track changes');
		}
	}

	/**
	 * Initializes the subscription for the filter.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {DispatcherContext} params.ctx - The dispatcher context object.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	initSubscription({ publish }) {
		gawk.watch(this.data, publish);
	}

	/**
	 * Responds to "call" service requests.
	 *
	 * @param {DispatcherContext} ctx - A dispatcher request context.
	 * @access private
	 */
	onCall(ctx) {
		ctx.response = this.data;
	}

	/**
	 * Handles the new subscriber.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {DispatcherContext} params.ctx - The dispatcher context object.
	 * @param {Function} params.publish - A function used to publish data to a dispatcher client.
	 * @access private
	 */
	onSubscribe({ publish }) {
		publish(this.data);
	}
}

/**
 * Wires up the routes and initialize the AMPLIFY CLI config, AMPLIFY SDK, and refresh timers.
 *
 * @param {Object} cfg - The appcd config.
 * @param {Object} pluginInfo - The plugin info.
 * @returns {Promise}
 */
export async function activate(cfg, pluginInfo) {
	// watch the AMPLIFY CLI config file for changes
	appcd.fs.watch({
		debounce: true,
		handler: init,
		paths: [ configFile ],
		type: 'amplify-config'
	});

	await init(pluginInfo);

	const authService = new AuthAccountService();
	await authService.init();
	appcd.register('/auth', authService);

	appcd.register('/auth/login', async ctx => {
		const { data } = ctx.request;
		const opts = {
			force: data?.force
		};

		if (data) {
			for (const prop of [ 'baseUrl', 'clientId', 'clientSecret', 'env', 'password', 'realm', 'secretFile', 'serviceAccount', 'username' ]) {
				opts[prop] = data[prop];
			}
		}

		const account = await sdk.auth.login(opts);
		refreshToken(account);

		if (!amplifyConfig.get(`auth.defaultOrg.${account.hash}`)) {
			amplifyConfig.set(`auth.defaultOrg.${account.hash}`, account.org.guid);
			amplifyConfig.save();
		}

		ctx.response = account;
	});

	appcd.register('/auth/logout/:accountName?', async ctx => {
		const { data, params } = ctx.request;
		const accountName = params?.accountName || data?.accountName;
		const opts = {};
		if (accountName) {
			opts.accounts = [ accountName ];
		} else {
			opts.all = true;
		}
		ctx.response = await sdk.auth.logout(opts);
	});

	appcd.register('/auth/server-info', async ctx => {
		ctx.response = await sdk.auth.serverInfo();
	});

	appcd.register('/auth/switch/:accountName?/:org?', async ctx => {
		const { data, params } = ctx.request;
		const accounts = await sdk.auth.list();
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
			account = await sdk.auth.switchOrg(account, org.id);
		}

		amplifyConfig.set('auth.defaultAccount', account.name);
		amplifyConfig.set(`auth.defaultOrg.${account.hash}`, org.guid);
		amplifyConfig.save();

		ctx.response = account;
	});

	appcd.register('/auth/:accountName?', async ctx => {
		ctx.response = await getAccount(ctx.request);
	});

	appcd.register('/mbs/app/create', async ctx => {
		const { data } = ctx.request;
		const account = await getAccount(ctx.request);

		if (!data.appGuid) {
			throw new Error('Missing app guid');
		}
		if (!data.appName) {
			throw new Error('Missing app name');
		}

		ctx.response = await sdk.mbs.createApps(account, data.appGuid, data.appName);
	});

	appcd.register('/mbs/user/create', async ctx => {
		const { data } = ctx.request;
		const account = await getAccount(ctx.request);

		if (!data.groupId) {
			throw new Error('Missing group id');
		}
		if (!data.env) {
			throw new Error('Missing environment name');
		}
		if (!data.userInfo) {
			throw new Error('Missing user info');
		}

		ctx.response = await sdk.mbs.createUser(account, data.groupId, data.env, data.userInfo);
	});

	appcd.register('/mbs/user', async ctx => {
		const { data } = ctx.request;
		const account = await getAccount(ctx.request);

		if (!data.groupId) {
			throw new Error('Missing group id');
		}
		if (!data.env) {
			throw new Error('Missing environment name');
		}

		ctx.response = await sdk.mbs.getUsers(account, data.groupId, data.env);
	});

	appcd.register('/org/env', async ctx => {
		const account = await getAccount(ctx.request);
		ctx.response = await sdk.org.getEnvironments(account);
	});

	appcd.register('/ti/aca-upload-url', async ctx => {
		const { data } = ctx.request;
		const account = await getAccount(ctx.request);

		if (!data.appGuid) {
			throw new Error('Missing app guid');
		}

		ctx.response = await sdk.ti.getACAUploadURL(account, data.appGuid);
	});

	appcd.register('/ti/app/set', async ctx => {
		const { data } = ctx.request;
		const account = await getAccount(ctx.request);

		if (!data.tiapp) {
			throw new Error('Missing tiapp');
		}

		ctx.response = await sdk.ti.setApp(account, data.tiapp);
	});

	appcd.register('/ti/app', async ctx => {
		const { data } = ctx.request;
		const account = await getAccount(ctx.request);

		if (!data.appGuid) {
			throw new Error('Missing app guid');
		}

		ctx.response = await sdk.ti.getApp(account, data.appGuid);
	});

	appcd.register('/ti/app-verify-url', async ctx => {
		ctx.response = sdk.ti.getAppVerifyURL();
	});

	appcd.register('/ti/build-update', async ctx => {
		const { data } = ctx.request;
		const account = await getAccount(ctx.request);

		if (!data.buildId) {
			throw new Error('Missing build ID');
		}
		if (!data.buildSHA) {
			throw new Error('Missing build SHA');
		}
		if (!data.keys) {
			throw new Error('Missing keys');
		}

		ctx.response = await sdk.ti.buildUpdate(account, {
			buildId:  data.buildId,
			buildSHA: data.buildSHA,
			keys:     data.keys
		});
	});

	appcd.register('/ti/build-verify', async ctx => {
		const { data } = ctx.request;
		const account = await getAccount(ctx.request);

		if (!data.appGuid) {
			throw new Error('Missing app guid');
		}
		if (!data.appId) {
			throw new Error('Missing app id');
		}
		if (!data.deployType) {
			throw new Error('Missing deploy type');
		}
		if (!data.fingerprint) {
			throw new Error('Missing fingerprint');
		}
		if (!data.ipAddress) {
			throw new Error('Missing ip address');
		}
		if (!data.tiapp) {
			throw new Error('Missing tiapp');
		}

		ctx.response = await sdk.ti.buildVerify(account, {
			appGuid:     data.appGuid,
			appId:       data.appId,
			deployType:  data.deployType,
			fingerprint: data.fingerprint,
			ipAddress:   data.ipAddress,
			modules:     data.modules, // not required
			tiapp:       data.tiapp
		});
	});

	appcd.register('/ti/downloads', async ctx => {
		const account = await getAccount(ctx.request);
		ctx.response = await sdk.ti.getDownloads(account);
	});

	appcd.register('/ti/enroll', async ctx => {
		const { data } = ctx.request;
		const account = await getAccount(ctx.request);

		if (!data.description) {
			throw new Error('Missing description');
		}
		if (!data.fingerprint) {
			throw new Error('Missing fingerprint');
		}
		if (!data.publicKey) {
			throw new Error('Missing public key');
		}

		ctx.response = await sdk.ti.enroll(account, {
			description: data.description,
			fingerprint: data.fingerprint,
			publicKey:   data.publicKey
		});
	});

	// log the status of each account
	statusTimer = setInterval(async () => {
		if (sdk) {
			const accounts = await sdk.auth.list();
			const now = Date.now();

			for (const account of accounts) {
				const accessExpiresIn = account.auth.expires.access - now;
				const refreshExpiresIn = account.auth.expires.refresh - now;
				if (refreshTimers[account.name] && refreshExpiresIn >= 1000) {
					statusLogger.log(`${highlight(account.name)} access token ${accessExpiresIn < 0 ? 'is expired' : `expires in ${highlight(prettyMs(accessExpiresIn))}`}, refresh token expires in ${highlight(prettyMs(refreshExpiresIn))}`);
				}
			}
		}
	}, 60000);
}

/**
 * Clear any refresh timers.
 *
 * @returns {Promise}
 */
export async function deactivate() {
	clearInterval(statusTimer);
	clearRefreshTimers();
}

/**
 * Clears all pending access token refresh timers.
 */
function clearRefreshTimers() {
	for (const [ name, obj ] of Object.entries(refreshTimers)) {
		clearTimeout(obj.handle);
		delete refreshTimers[name];
	}
}

/**
 * Get an account by name from the request by checking authenticated accounts in the token store.
 *
 * By checking the account against the token store, it's much quicker than doing a `find()` which
 * will refresh the user info, org info, and refresh the access token. `list()` will only return
 * non-expired accounts and it's probably ok if the user/org info is stale since it'll be refreshed
 * when the token is set to expire.
 *
 * @param {Object} req - The incoming request from the dispatcher context.
 * @returns {Promise} Resolves the account object.
 */
async function getAccount(req) {
	const accountName = req.params?.accountName || req.data?.accountName;
	if (!accountName) {
		throw new Error('Missing account name');
	}
	const accounts = await sdk.auth.list();
	const account = accounts.find(a => a.name === accountName);
	if (account) {
		return account;
	}
	throw new Error(`Account "${accountName}" not found`);
}

/**
 * Loads the AMPLIFY CLI and AMPLIFY SDK during plugin activation and when the AMPLIFY CLI config
 * changes.
 *
 * @param {Object} pluginInfo - The plugin info.
 * @returns {Promise}
 */
async function init(pluginInfo) {
	clearRefreshTimers();
	amplifyConfig = loadConfig({ configFile });
	sdk = new AmplifySDK(buildParams({}, amplifyConfig));

	const accounts = await sdk.auth.list();

	if (!accounts.length && pluginInfo.autoStarted) {
		console.log('The AMPLIFY plugin was auto-started, but there are no accounts to keep refreshed');
		console.log('Exiting to free up resources');
		process.exit(0);
	}

	accounts.forEach(refreshToken);
}

/**
 * Schedules an account to have its access token refreshed.
 *
 * @param {Object} account - The account to refresh.
 */
function refreshToken(account) {
	if (!account) {
		return;
	}

	const { name } = account;

	if (refreshTimers[name]) {
		clearTimeout(refreshTimers[name].handle);
		delete refreshTimers[name];
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
	refreshTimers[name] = {
		duration: refreshIn,
		handle: setTimeout(async () => {
			try {
				delete refreshTimers[name];
				const updatedAccount = await sdk.auth.find(name);
				if (updatedAccount) {
					refreshToken(updatedAccount);
				} else {
					refreshLogger.warn(`Refresh timer for account "${name}" was fired too late and token could not be refreshed`);
				}
			} catch (err) {
				refreshLogger.error(err.toString());
			}
		}, refreshIn)
	};
}
