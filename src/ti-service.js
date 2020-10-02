import AmplifyServiceDispatcher from './amplify-service-dispatcher';

/**
 * Defines the service endpoints for Titanium SDK related functions.
 */
export default class TiService extends AmplifyServiceDispatcher {
	/**
	 * Wires up the Titanium SDK service endpoints.
	 *
	 * @param {AmplifySDK} sdk - The AMPLIFY SDK instance.
	 * @param {Config} amplifyConfig - The AMPLIFY CLI config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(sdk, amplifyConfig) {
		await super.activate(sdk, amplifyConfig);

		this.register('/aca-upload-url', async ctx => {
			const { data } = ctx.request;
			const account = await this.getAccount(ctx.request);

			if (!data.appGuid) {
				throw new Error('Missing app guid');
			}

			ctx.response = await this.sdk.ti.getACAUploadURL(account, data.appGuid);
		});

		this.register('/app/set', async ctx => {
			const { data } = ctx.request;
			const account = await this.getAccount(ctx.request);

			if (!data.tiapp) {
				throw new Error('Missing tiapp');
			}

			ctx.response = await this.sdk.ti.setApp(account, data.tiapp);
		});

		this.register('/app', async ctx => {
			const { data } = ctx.request;
			const account = await this.getAccount(ctx.request);

			if (!data.appGuid) {
				throw new Error('Missing app guid');
			}

			ctx.response = await this.sdk.ti.getApp(account, data.appGuid);
		});

		this.register('/app-verify-url', async ctx => {
			ctx.response = this.sdk.ti.getAppVerifyURL();
		});

		this.register('/build-update', async ctx => {
			const { data } = ctx.request;
			const account = await this.getAccount(ctx.request);

			if (!data.buildId) {
				throw new Error('Missing build ID');
			}
			if (!data.buildSHA) {
				throw new Error('Missing build SHA');
			}
			if (!data.keys) {
				throw new Error('Missing keys');
			}

			ctx.response = await this.sdk.ti.buildUpdate(account, {
				buildId:  data.buildId,
				buildSHA: data.buildSHA,
				keys:     data.keys
			});
		});

		this.register('/build-verify', async ctx => {
			const { data } = ctx.request;
			const account = await this.getAccount(ctx.request);

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
			if (!data.name) {
				throw new Error('Missing name');
			}
			if (!data.tiapp) {
				throw new Error('Missing tiapp');
			}

			ctx.response = await this.sdk.ti.buildVerify(account, {
				appGuid:     data.appGuid,
				appId:       data.appId,
				deployType:  data.deployType,
				fingerprint: data.fingerprint,
				modules:     data.modules,
				name:        data.name,
				tiapp:       data.tiapp
			});
		});

		this.register('/downloads', async ctx => {
			const account = await this.getAccount(ctx.request);
			ctx.response = await this.sdk.ti.getDownloads(account);
		});

		this.register('/enroll', async ctx => {
			const { data } = ctx.request;
			const account = await this.getAccount(ctx.request);

			if (!data.fingerprint) {
				throw new Error('Missing fingerprint');
			}
			if (!data.publicKey) {
				throw new Error('Missing public key');
			}

			ctx.response = await this.sdk.ti.enroll(account, {
				description: 'Titanium user',
				fingerprint: data.fingerprint,
				publicKey:   data.publicKey
			});
		});
	}
}
