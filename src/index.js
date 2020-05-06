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
import prettyMs from 'pretty-ms';
import { snooplogg } from 'appcd-logger';

const { highlight } = snooplogg.styles;
const { configFile } = locations;
const authTimers = {};
let amplifyConfig;
let sdk;

// TODO:
//	auto start plugin!
//	jsdoc

function clearTimers() {
	for (const [ id, timer ] of Object.entries(authTimers)) {
		clearTimeout(timer);
		delete authTimers[id];
	}
}

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

async function init() {
	clearTimers();
	amplifyConfig = loadConfig({ configFile });
	sdk = new AmplifySDK(buildParams({}, amplifyConfig));
	(await sdk.auth.list()).forEach(refreshToken);
}

function refreshToken(account) {
	if (!account) {
		return;
	}

	if (authTimers[account.name]) {
		clearTimeout(authTimers[account.name]);
	}

	const refreshIn = account.auth.expires.refresh - 60000 - Date.now();
	if (refreshIn < 1000) {
		// refresh token is going to exprire before we can do anything about it, so just return and
		// let the account get purged
		return;
	}

	console.log(`Refresh access token in ${highlight(prettyMs(refreshIn))}`);

	// set a timer to refresh the access token 1 minutes before the refresh token is set to expire
	authTimers[account.name] = setTimeout(async () => {
		try {
			delete authTimers[account.name];
			refreshToken(await sdk.auth.find(account.name));
		} catch (e) {
			console.error(`Failed to refresh token: ${e.message}`);
		}
	}, refreshIn);
}

/**
 *
 *
 * @returns {Promise}
 */
export async function activate() {
	appcd.register('/auth', async ctx => {
		const accounts = await sdk.auth.list();
		const defaultAccount = amplifyConfig.get('auth.defaultAccount');
		ctx.response = accounts.map(account => {
			account.active = account.name === defaultAccount;
			return account;
		});
	});

	appcd.register('/auth/login', async ctx => {
		const account = await sdk.auth.login();
		refreshToken(account);
		ctx.response = account;
	});

	appcd.register('/auth/logout/:accountName?', async ctx => {
		const { data, params } = ctx.request;
		const accountName = params.accountName || data.accountName;
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
		const accountName = params.accountName || data.accountName;
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
		amplifyConfig.set(`auth.defaultOrg.${account.hash}`, org.id);
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

	appcd.register('/ti/aca-upload-url/:guid', async ctx => {
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

	appcd.register('/ti/app/:guid?', async ctx => {
		const { data, params } = ctx.request;
		const account = await getAccount(ctx.request);
		const appGuid = params.guid || data.appGuid;

		if (!appGuid) {
			throw new Error('Missing app guid');
		}

		ctx.response = await sdk.ti.getApp(account, appGuid);
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

	// watch the AMPLIFY CLI config file for changes
	appcd.fs.watch({
		debounce: true,
		handler: init,
		paths: [ configFile ],
		type: 'amplify-config'
	});

	await init();
}

/**
 * ?
 *
 * @returns {Promise}
 */
export async function deactivate() {
	clearTimers();
}
