import AuthService from './auth-service';
import Dispatcher from 'appcd-dispatcher';
import MBSService from './mbs-service';
import OrgService from './org-service';
import TiService from './ti-service';
import {
	AmplifySDK,
	buildAuthParams,
	loadConfig,
	locations
} from '@axway/amplify-cli-utils';

/**
 * Manages the state for the AMPLIFY SDK related services. It watches the AMPLIFY CLI's config
 * file and reloads it if it's changed along with recreate the AMPLIFY SDK instance.
 */
export default class AmplifyService extends Dispatcher {
	/**
	* The AMPLIFY CLI config object, not the appcd config. It's a `config-kit` instance.
	* @type {Config}
	*/
	amplifyConfig = null;

	/**
	 * A hash of options used to create the AMPLIFY SDK instance used to only recreate the
	 * instance if something changes.
	 * @type {String}
	 */
	sdkHash = null;

	/**
	 * Initializes the AMPLIFY CLI config watcher, initializes the AMPLIFY SDK, and wires up the
	 * various services.
	 *
	 * @param {Object} pluginInfo - The plugin info.
	 * @returns {Promise}
	 * @access public
	 */
	async activate(pluginInfo) {
		this.dataDir = pluginInfo.dataDir;

		/**
		 * A map of service endpoints to service dispatcher instances.
		 * @type {Object}
		 */
		this.services = {
			'/auth': new AuthService(),
			'/mbs':  new MBSService(),
			'/org':  new OrgService(),
			'/ti':   new TiService()
		};

		// if the network config changes, then recreate the AmplifySDK instance
		appcd.config.watch('network', networkConfig => {
			const sdk = this.createSDK(networkConfig);
			if (sdk) {
				Object.values(this.services).forEach(svc => svc.setSDK(sdk));
			}
		});

		// watch the AMPLIFY CLI config file for changes
		appcd.fs.watch({
			debounce: true,
			handler: async () => {
				this.amplifyConfig = loadConfig({ configFile: locations.configFile });
				const sdk = this.createSDK();
				for (const service of Object.values(this.services)) {
					await service.setConfig(this.amplifyConfig);
					if (sdk) {
						await service.setSDK(sdk);
					}
				}
			},
			paths: [ locations.configFile ],
			type: 'amplify-config'
		});

		// load the AMPLIFY CLI configuration
		this.amplifyConfig = loadConfig({ configFile: locations.configFile });

		// create our initial AMPLIFY SDK instance used to initialize our services
		const sdk = this.createSDK();

		for (const [ endpoint, service ] of Object.entries(this.services)) {
			this.register(endpoint, service);
			await service.activate(sdk, this.amplifyConfig, pluginInfo);
		}
	}

	/**
	 * Creates a new AMPLIFY SDK instance using the specified network configuration and AMPLIFY CLI
	 * configuration. It will only create a new instance if the AMPLIFY SDK parameters have changed
	 * since the last call.
	 *
	 * @param {Object} [network] - The network configuration settings.
	 * @returns {AmplifySDK}
	 * @access private
	 */
	createSDK(network = appcd.config.get('network')) {
		// build the params
		const params = buildAuthParams({
			ca:        network?.caFile,
			cert:      network?.certFile,
			key:       network?.keyFile,
			proxy:     network?.proxy,
			strictSSL: network?.strictSSL,
		}, this.amplifyConfig);

		params.homeDir = this.dataDir;

		// hash the params to see if we even need to create a new AMPLIFY SDK instance
		const str = JSON.stringify(params);
		let sdkHash = 5381;
		let i = str.length;
		while (i) {
			sdkHash = sdkHash * 33 ^ str.charCodeAt(--i);
		}
		sdkHash >>>= 0;

		// create the AMPLIFY SDK instance if needed
		if (this.sdkHash !== sdkHash) {
			console.log(`AMPLIFY SDK param hash changed (${sdkHash} != ${this.sdkHash}), creating new AMPLIFY SDK instance`);
			this.sdkHash = sdkHash;
			return new AmplifySDK(params);
		}
	}

	/**
	 * Shutdown the services.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async deactivate() {
		for (const service of Object.values(this.services)) {
			await service.deactivate();
		}
	}
}
