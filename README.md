# @appcd/plugin-amplify

AMPLIFY platform service for the Appc Daemon.

Report issues to [GitHub issues][2]. Official issue tracker in [JIRA][3].

## Services

 * [Authentication](#Authentication)
   - [`/auth`](#auth)
   - [`/auth/:accountName?`](#authaccountName)
   - [`/auth/login`](#authlogin)
   - [`/auth/logout/:accountName?`](#authlogoutaccountName)
   - [`/auth/server-info`](#authserver-info)
   - [`/auth/switch/:accountName?/:org?`](#authswitchaccountNameorg)
 * [MBS](#MBS)
   - [`/mbs/app/create`](#mbsappcreate)
   - [`/mbs/user`](#mbsuser)
   - [`/mbs/user/create`](#mbsusercreate)
 * [Org](#Org)
   - [`/org/env`](#orgenv)
 * [Titanium](#Titanium)
   - [`/ti/aca-upload-url`](#tiaca-upload-url)
   - [`/ti/app`](#tiapp)
   - [`/ti/app/set`](#tiappset)
   - [`/ti/app-verify-url`](#tiapp-verify-url)
   - [`/ti/build-update`](#tibuild-update)
   - [`/ti/build-verify`](#tibuild-verify)
   - [`/ti/downloads`](#tidownloads)
   - [`/ti/enroll`](#tienroll)

## Authentication

### `/auth`

Returns a list of all authenticated accounts.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/auth');
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/auth
{
  "status": 200,
  "message": [
    {
      "auth": {
        "authenticator": "PKCE",
        "baseUrl": "",
        "clientId": "",
        "env": {
          "name": "",
          "baseUrl": "",
          "redirectLoginSuccess": ""
        },
        "expires": {
          "access": 1588777919779,
          "refresh": 1588797719779
        },
        "realm": "",
        "tokens": {
          "access_token": "",
          "expires_in": 1234,
          "refresh_expires_in": 1234,
          "refresh_token": "",
          "token_type": "bearer",
          "id_token": "",
          "not-before-policy": 1234,
          "session_state": "",
          "scope": "openid"
        }
      },
      "hash": "<client_id>:<hash>",
      "name": "<client_id>:<email>",
      "org": {
        "guid": "",
        "id": 1234,
        "name": ""
      },
      "orgs": [
        {
          "guid": "",
          "id": 1234,
          "name": ""
        }
      ],
      "user": {
        "axwayId": "",
        "email": "",
        "firstName": "",
        "guid": "",
        "lastName": "",
        "organization": "",
        "is2FAEnabled": false
      },
      "sid": "",
      "active": true
    }
  ],
  "fin": true,
  "statusCode": "200"
}
```

To listen for changes, pass in the `--subscribe` flag:

```sh
$ appcd exec /amplify/latest/auth --subscribe
```

### `/auth/:accountName?`

Gets a specific account.

The `accountName` may also be passed in via the `data` payload.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/auth/<client_id>:<email>');
console.log(response);
```

```js
const { response } = await appcd.call('/amplify/latest/auth', { accountName: '<client_id>:<email>' });
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/auth/<client_id>:<email>
{
  "status": 200,
  "message": {
    // account info
  },
  "fin": true,
  "statusCode": "200"
}
```

```sh
$ appcd exec /amplify/latest/auth '{"accountName":"<client_id>:<email>"}'
{
  "status": 200,
  "message": {
    // account info
  },
  "fin": true,
  "statusCode": "200"
}
```

### `/auth/login`

Performs authentication and returns the associated account object. By default, the login will use a
PKCE web browser-based flow.

> Note: Manual authentication is not supported.

Optional `data` paramaters:

 * General:
   * `baseUrl`: (String) [optional] The base URL to use for all outgoing requests.
   * `clientId`: (String) The client id to specify when authenticating.
   * `env`: (String) [optional] The environment name. Must be `"dev"`, `"preprod"`, or `"prod"`. The
     environment is a shorthand way of specifying a Axway default base URL. Defaults to `"prod"`.
   * `realm`: (String) **[required]** The name of the realm to authenticate with.
 * PKCE:
   * This is the default authentication method and has no options.
 * Username/Password:
   * `username`: (String) [optional] The username to login as.
   * `password`: (String) [optional] The password use.
 * Client Secret Credentials:
   * `clientSecret`: (String) [optional] The client-specific secret key to login with.
   * `serviceAccount`: (Boolean) [optional] When `true`, indicates the consumer is a service and not
     a user and that authentication should be _non-interactive_.
 * JSON Web Token:
   * `secretFile`: (String) [optional] The path to the file containing the secret key to login
     with. This is RSA private key, usually stored in a `.pem` file.


#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/auth/login');
console.log(response);
```

```js
const { response } = await appcd.call('/amplify/latest/auth/login', {
	clientId: 'foo',
	clientSecret: 'bar'
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/auth/login
{
  "status": 200,
  "message": {
    // account info
  },
  "fin": true,
  "statusCode": "200"
}
```

```sh
$ appcd exec /amplify/latest/auth/login '{"clientId":"foo","clientSecret":"bar"}'
{
  "status": 200,
  "message": {
    // account info
  },
  "fin": true,
  "statusCode": "200"
}
```

### `/auth/logout/:accountName?`

Revokes the access token for a specific account or all accounts.

The `accountName` may also be passed in via the `data` payload.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/auth/logout');
console.log(response);
```

```js
const { response } = await appcd.call('/amplify/latest/auth/logout/<client_id>:<email>');
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/auth/logout
{
  "status": 200,
  "message": [
	  // list of revoked accounts
  ],
  "fin": true,
  "statusCode": "200"
}
```

```sh
$ appcd exec /amplify/latest/auth/logout '{"accountName":"<client_id>:<email>"}'
{
  "status": 200,
  "message": [
	  // list of revoked accounts
  ],
  "fin": true,
  "statusCode": "200"
}
```

### `/auth/server-info`

Returns information about the OpenID server.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/auth/server-info');
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/auth/server-info
{
  "status": 200,
  "message": {
    // server info
  },
  "fin": true,
  "statusCode": "200"
}
```

### `/auth/switch/:accountName?/:org?`

Switches the default account and organization. This will synchronize with the web platform.

The `accountName` and `org` may also be passed in via the `data` payload. `org` can be the org
name, guid, or id (legacy).

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/auth/switch/<client_id>:<email>/<org>');
console.log(response);
```

```js
const { response } = await appcd.call('/amplify/latest/auth/switch', {
	accountName: '<client_id>:<email>'
	org: '<name>' // or guid/id
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/auth/switch/<client_id>:<email>/<org>
{
  "status": 200,
  "message": {
    // account info
  },
  "fin": true,
  "statusCode": "200"
}
```

```sh
$ appcd exec /amplify/latest/auth/switch '{"accountName":"<client_id>:<email>","org":"<name>"}'
{
  "status": 200,
  "message": {
    // account info
  },
  "fin": true,
  "statusCode": "200"
}
```

## MBS

### `/mbs/app/create`

Create an MBS app in each platform environment.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/mbs/app/create', {
	accountName: '<client_id>:<email>',
	appGuid: '',
	appName: ''
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/mbs/app/create '{"accountName":"","appGuid":"","appName":""}'
```

### `/mbs/user`

Retrieves all MBS users for a given group id (app guid) and environment (production/development).

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/mbs/user', {
	accountName: '<client_id>:<email>',
	groupId: '',
	env: ''
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/mbs/user '{"accountName":"","groupId":"","env":""}'
```

### `/mbs/user/create`

Create a new MBS user for a given group id (app guid) and environment (production/development).

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/mbs/user/create', {
  accountName: '<client_id>:<email>',
  groupId: '',
  env: '',
  userInfo: {
    admin:         undefined,
    custom_fields: undefined,
    email:         'user@domain.com',
    first_name:    '',
    last_name:     '',
    password:      '', // required
    password_confirmation: '', // required
    photo_id:      undefined,
    role:          undefined,
    tags:          undefined,
    username:      undefined
  }
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/mbs/user/create '{"accountName":"","groupId":"","env":"","userInfo":{}}'
```

## Org

### `/org/env`

Retrieve a list of all available platform environments such as 'production' and 'development'.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/org/env', {
  accountName: '<client_id>:<email>'
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/mbs/user/create '{"accountName":"<client_id>:<email>"}'
```

## Titanium

### `/ti/aca-upload-url`

Get the URL for upload debug symbols after building an iOS app.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/ti/aca-upload-url', {
  accountName: '<client_id>:<email>',
  appGuid: ''
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/ti/aca-upload-url '{"accountName":"<client_id>:<email>","appGuid":""}'
```

### `/ti/app`

Get info about a Titanium app.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/ti/app', {
  accountName: '<client_id>:<email>',
  appGuid: ''
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/ti/app '{"accountName":"<client_id>:<email>","appGuid":""}'
```

### `/ti/app/set`

Update or register a Titanium app.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/ti/app/set', {
  accountName: '<client_id>:<email>',
  tiapp: '<ti:app>...</ti:app>'
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/ti/app/set '{"accountName":"<client_id>:<email>","tiapp":""}'
```


### `/ti/app-verify-url`

Returns the runtime app verification URL.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/ti/app-verify-url');
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/ti/app-verify-url
```

### `/ti/build-update`

Updates Titanium app build info.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/ti/build-update', {
  accountName: '<client_id>:<email>',
  buildId: '',
  buildSHA: '',
  keys: {}
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/ti/build-update '{"accountName":"<client_id>:<email>","buildId":"","buildSHA":"","keys":{}}'
```

### `/ti/build-verify`

Verifies a Titanium app and modules prior to a build.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/ti/build-verify', {
  accountName: '<client_id>:<email>',
  appGuid: '',
  appId: '',
  deployType: '',
  fingerprint: '',
  ipAddress: '',
  tiapp: '<ti:app>...</ti:app>'
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/ti/build-verify \
'{"accountName":"<client_id>:<email>","appGuid":"","appId":"","deployType":"",\
"fingerprint":"","ipAddress":"","tiapp":"<ti:app>...</ti:app>"}'
```

### `/ti/downloads`

Returns a list of available Titanium modules.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/ti/downloads', {
  accountName: '<client_id>:<email>'
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/ti/downloads '{"accountName":"<client_id>:<email>"}'
```

### `/ti/enroll`

Creates developer certificate for Titanium development.

#### API Usage

```js
const { response } = await appcd.call('/amplify/latest/ti/enroll', {
  accountName: '<client_id>:<email>',
  description: '',
  fingerprint: '',
  publicKey: ''
});
console.log(response);
```

#### CLI Usage

```sh
$ appcd exec /amplify/latest/ti/enroll \
'{"accountName":"<client_id>:<email>","description":"","fingerprint":"","publicKey":""}'
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/appcd-plugin-amplify/blob/master/LICENSE
[2]: https://github.com/appcelerator/appcd-plugin-amplify/issues
[3]: https://jira.appcelerator.org/projects/DAEMON/issues
