import AmplifyServiceDispatcher from './amplify-service-dispatcher';

/**
 * Defines the service endpoints for AMPLIFY Platform user organizations related functions.
 */
export default class OrgService extends AmplifyServiceDispatcher {
	/**
	 * Wires up the organization service endpoints.
	 *
	 * @param {AmplifySDK} sdk - The AMPLIFY SDK instance.
	 * @param {Config} amplifyConfig - The AMPLIFY CLI config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(sdk, amplifyConfig) {
		await super.activate(sdk, amplifyConfig);

		this.register('/env', async ctx => {
			const account = await this.getAccount(ctx.request);
			ctx.response = await this.sdk.org.getEnvironments(account);
		});
	}
}
