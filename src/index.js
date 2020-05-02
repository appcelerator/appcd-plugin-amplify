/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

/**
 * ?
 *
 * @param {Config} cfg - An Appc Daemon config object
 * @returns {Promise}
 */
export async function activate(cfg) {
}

/**
 * ?
 *
 * @returns {Promise}
 */
export async function deactivate() {
}
