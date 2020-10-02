import AmplifyService from './amplify-service';

const amplifyService = new AmplifyService();

/**
 * Activates and wires up the AMPLIFY service.
 *
 * @returns {Promise}
 */
export async function activate() {
	await amplifyService.activate();
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
