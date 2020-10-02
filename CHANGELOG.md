# v2.0.0

 * BREAKING CHANGE: Dropped support for appcd plugin API version 1.0 and require API version 2.0,
   which was initially introduced in `appcd@4.0.0`.
 * feat: Added `/auth/active` endpoint that returns the active authenticated account.
 * fix: Removed `ipaddress` from build verify payload to comply with GDPR.
 * refactor: Broke each set of service endpoints into separate files.
 * chore: Updated dependencies.

# v1.0.4 (Jun 23, 2020)

 * refactor: Removed token refresh threshold and refresh access token as soon as it expires.
 * chore: Updated dependencies

# v1.0.3 (Jun 9, 2020)

 * chore: Updated dependencies

# v1.0.2 (Jun 5, 2020)

 * chore: Remove `appcdVersion` and add `apiVersion` API version 1.x and 2.x.
 * chore: Updated dependencies

# v1.0.1 (May 8, 2020)

 * fix: Added debounce around token store file changes.
 * fix: Improved debug logging.

# v1.0.0 (May 7, 2020)

 * Initial release.
