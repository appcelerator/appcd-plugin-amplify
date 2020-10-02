import Dispatcher from 'appcd-dispatcher';

/**
 * A base class for dispatcher namespace for each of the AMPLIFY services.
 */
export default class AmplifyServiceDispatcher extends Dispatcher {
	/**
	* The AMPLIFY CLI config object, not the appcd config. It's a `config-kit` instance.
	* @type {Config}
	*/
	amplifyConfig = null;

	/**
	 * The AMPLIFY SDK instance.
	 * @type {AmplifySDK}
	 */
	sdk = null;

	/**
	 * Initializes the AMPLIFY SDK and AMPLIFY CLI config instances.
	 *
	 * @param {AmplifySDK} sdk - The AMPLIFY SDK instance.
	 * @param {Config} amplifyConfig - The AMPLIFY CLI config object.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(sdk, amplifyConfig) {
		this.sdk = sdk;
		this.amplifyConfig = amplifyConfig;
	}

	/**
	 * This is a base method that is intended to be overwritten by the descending class.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		// noop
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
	 * @access private
	 */
	async getAccount(req) {
		const accountName = req.params?.accountName || req.data?.accountName;
		if (!accountName) {
			throw new Error('Missing account name');
		}
		const accounts = await this.sdk.auth.list();
		const account = accounts.find(a => a.name === accountName);
		if (account) {
			return account;
		}
		throw new Error(`Account "${accountName}" not found`);
	}

	/**
	 * Sets the AMPLIFY CLI config instance.
	 *
	 * @param {Config} amplifyConfig - The AMPLIFY CLI config object.
	 * @returns {Promise}
	 * @access public
	 */
	async setConfig(amplifyConfig) {
		this.amplifyConfig = amplifyConfig;
	}

	/**
	 * Sets the AMPLIFY SDK instance.
	 *
	 * @param {AmplifySDK} sdk - The AMPLIFY SDK instance.
	 * @returns {Promise}
	 * @access public
	 */
	async setSDK(sdk) {
		this.sdk = sdk;
	}
}
