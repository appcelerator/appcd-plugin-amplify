import AmplifyServiceDispatcher from './amplify-service-dispatcher';

/**
 * Defines the service endpoints for MBS related functions.
 */
export default class MBSService extends AmplifyServiceDispatcher {
	/**
	 * Wires up the MBS service endpoints.
	 *
	 * @param {AmplifySDK} sdk - The AMPLIFY SDK instance.
	 * @param {Config} amplifyConfig - The AMPLIFY CLI config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(sdk, amplifyConfig) {
		await super.activate(sdk, amplifyConfig);

		this.register('/app/create', async ctx => {
			const { data } = ctx.request;
			const account = await this.getAccount(ctx.request);

			if (!data.appGuid) {
				throw new Error('Missing app guid');
			}
			if (!data.appName) {
				throw new Error('Missing app name');
			}

			ctx.response = await this.sdk.mbs.createApps(account, data.appGuid, data.appName);
		});

		this.register('/user/create', async ctx => {
			const { data } = ctx.request;
			const account = await this.getAccount(ctx.request);

			if (!data.groupId) {
				throw new Error('Missing group id');
			}
			if (!data.env) {
				throw new Error('Missing environment name');
			}
			if (!data.userInfo) {
				throw new Error('Missing user info');
			}

			ctx.response = await this.sdk.mbs.createUser(account, data.groupId, data.env, data.userInfo);
		});

		this.register('/user', async ctx => {
			const { data } = ctx.request;
			const account = await this.getAccount(ctx.request);

			if (!data.groupId) {
				throw new Error('Missing group id');
			}
			if (!data.env) {
				throw new Error('Missing environment name');
			}

			ctx.response = await this.sdk.mbs.getUsers(account, data.groupId, data.env);
		});

	}
}
