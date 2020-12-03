import AmplifyService from './amplify-service';

const amplifyService = new AmplifyService();

/**
 * Activates and wires up the AMPLIFY service.
 *
 * @param {Object} cfg - The appcd config.
 * @param {Object} pluginInfo - The plugin info.
 * @returns {Promise}
 */
export async function activate(cfg, pluginInfo) {
	await amplifyService.activate(pluginInfo);
	appcd.register('/', amplifyService);
}

/**
 * Shuts down the AMPLIFY service.
 *
 * @returns {Promise}
 */
export async function deactivate() {
	await amplifyService.deactivate();
}
