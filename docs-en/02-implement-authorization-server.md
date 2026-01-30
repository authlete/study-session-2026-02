# Implementing the Authorization Server

## Libraries Used

This hands-on session uses the beta release of [@authlete/typescript-sdk](https://github.com/authlete/authlete-typescript-sdk).
The web server uses [hono](https://hono.dev/), but you may use any familiar framework such as express.

Example usage of [@authlete/typescript-sdk](https://github.com/authlete/authlete-typescript-sdk):

```ts
import { Authlete } from "@authlete/typescript-sdk";

const authlete = new Authlete({
  bearer: process.env["AUTHLETE_BEARER"] ?? "",
});

async function run() {
  const result = await authlete.service.get({
    serviceId: "<id>",
  });

  console.log(result);
}
```

This sample already includes the Authlete SDK and creates the instance by loading the following environment variables from [.env.example](/.env.example).

```conf
# Authlete Settings
AUTHLETE_BASE_URL=https://jp.authlete.com
AUTHLETE_SERVICE_APIKEY=your_authlete_service_apikey_here # Replace with your Authlete service API key
AUTHLETE_SERVICE_ACCESSTOKEN=your_authlete_service_accesstoken_here # Replace with your Authlete service access token
```

Initialization is done in the [getAuthlete](/apps/oauth-server/src/authlete.ts) method.
This instance is already added to the hono context, so each handler should obtain it from the context. Details are described later.

## Endpoints to Implement

The OAuth/OIDC endpoints to implement are:

|Method| Path | Name | Description | Authlete API |
| ---- | ---- | ---- | ----------- | ------------ |
|GET|/authorize|Authorization endpoint|Endpoint that handles authorization requests from client applications|[/api/{serviceId}/auth/authorization](https://docs.authlete.com/en/shared/latest#post-/api/-serviceId-/auth/authorization) |
|GET|/consent|User consent result endpoint|Endpoint that obtains user consent results and issues authorization codes| [/api/{serviceId}/auth/authorization/issue](https://docs.authlete.com/en/shared/latest#post-/api/-serviceId-/auth/authorization/issue) |
|POST|/token | Token endpoint|Endpoint that handles token requests from client applications| [/api/{serviceId}/auth/token](https://docs.authlete.com/en/shared/latest#post-/api/-serviceId-/auth/token) |
|GET|/.well-known/openid-configuration|OpenID Discovery endpoint|Endpoint that publishes server metadata|[/api/{serviceId}/service/configuration](https://docs.authlete.com/en/shared/latest#get-/api/-serviceId-/service/configuration) |
|GET|/jwks | JWK Set endpoint | Endpoint that publishes public keys for token signature verification in JWKS format|[/api/{serviceId}/service/jwks/get](https://docs.authlete.com/en/shared/latest#get-/api/-serviceId-/service/jwks/get) |

Each endpoint calls the corresponding Authlete API shown in the Authlete API column to implement the authorization flow. The authorization server parses Authlete responses, applies authorization-server-specific customization, and returns results to clients.

## Implementation Approach

The file [index.ts](/apps/oauth-server/src/index.ts) contains stub implementations for each endpoint. In this hands-on, you will implement each endpoint. The `/authorize` endpoint includes a sample SDK call as a starting point.

The implementation flow is:

1. Get the Authlete SDK instance (authlete) and serviceId from the hono context
1. Parse the client request and extract required information such as headers, query parameters, and body
1. Call the Authlete API via the Authlete SDK using the extracted information
1. Parse the Authlete API response and send a response to the client

```ts
app.get('/authorize', async (c: Context) => {
  console.log('GET /authorize called');

  // implement authorization endpoint logic here
  const { authlete, serviceId } = c.var;
  const parameters = c.req.url.split('?')[1] ?? '';
  const authorizationRequest: AuthorizationRequest = {
      parameters
  };  
  const response: AuthorizationResponse = await authlete.authorization.processRequest({
      serviceId: serviceId,
      authorizationRequest
  });
  const action = response.action;
  switch (action) {
    case 'INTERNAL_SERVER_ERROR':
        c.header('Content-Type', 'application/json');
        return c.body(responseContent, 500);
    case 'BAD_REQUEST':
        c.header('Content-Type', 'application/json');
        return c.body(responseContent, 400);
    case 'LOCATION':
        if (responseContent) {
            return c.redirect(responseContent);
        }
        c.header('Content-Type', 'application/json');
        return c.body('', 500);
    case 'FORM':
        c.header('Content-Type', 'text/html; charset=UTF-8');
        return c.body(responseContent, 200);
    case 'INTERACTION':
        ....
  }
}
);
```

Refer to each API document for how to parse Authlete API responses.
Basically, you generate responses according to the `action` parameter in the Authlete API response.

[Basic concepts for handling responses from Authlete APIs - Authlete](https://www.authlete.com/ja/kb/getting-started/implementing-an-authorization-server/handling-responses-from-authlete-apis/)

In this implementation, we do not implement user authentication, so we assume the following demo user is already authenticated.
We also add the claims shown below to the ID token. This is required because tools in the MCP server you will integrate later require specific claims.

```ts
const demoUser: User = {
    id: 'demo-user',
    claims: {
        family_name: 'Demo',
        given_name: 'Authlete',
        preffered_username: "Authlete Demo User"
    },
    consentedScopes: [],
};
```

## Sample Implementation

To assist development, a SPA (Single Page Application) that obtains tokens via the authorization code flow is implemented at `/sample-client`. The first goal is to successfully obtain tokens with this client.

Sample implementations for each endpoint are included in [/apps/oauth-server/src/samples/handlers.ts](/apps/oauth-server/src/samples/handlers.ts). Use them as a reference if you get stuck. You can also implement a working demo server by specifying the sample handlers as shown below.

```ts
import {
  authorizeHandler,
  consentHandler,
  jwksHandler,
  openIdConfigHandler,
  sampleClientHandler,
  tokenHandler,
} from './samples/handlers';

app.get('/authorize', authorizeHandler);
app.post('/consent', consentHandler);
app.post('/token', tokenHandler);
app.get('/jwks', jwksHandler);
app.get('/.well-known/openid-configuration', openIdConfigHandler);
```

If implementing your own handlers is difficult, use the above handlers to verify behavior.

## Obtain Tokens with the Sample Client

After implementation, access http://localhost:9000/sample-client and send an authorization request.
Click the `Start authorization` button to send the request. If the authorization endpoint returns a proper authorization code response and you can exchange the code using the `Exchange code` button, you are done.

Decode the token using https://jwt.io and verify the payload. Confirm that it includes the parameters specified in the authorization request and the user claims embedded by the authorization server.

## Publish over HTTPS

In `/sample-client`, the authorization endpoint and token endpoint are referenced with fixed relative paths such as `/authorize` and `/token`.
For MCP client integration, however, you must provide endpoints and `jwks_uri` through metadata.

While metadata values such as the authorization endpoint reflect the service settings, for security reasons these endpoints can only be configured with HTTPS. Therefore, the authorization server itself (which uses Authlete as a backend) must be hosted over HTTPS. *

To publish over HTTPS, you can use a self-signed certificate (e.g., with `mkcert`), deploy to a hosting service, or expose via a proxy service like `ngrok`. Here we use `ngrok` to minimize environment differences.

After setting up ngrok as described in the README, run `ngrok http 9000`.
Copy the URL shown under Forwarding and apply it to the following locations.

1. `.env` `OAUTH_SERVER_ISSUER`
2. Endpoint settings for the target service in the Authlete console

| Property in metadata | Setting location | Value to set |
| -------------------- | ---------------- | ------------ |
| issuer | [Basic Settings] > [Advanced Settings] > [Issuer Identifier] | `OAUTH_SERVER_ISSUER` |
| authorization_endpoint | [Endpoints] > [Authorization] > [General] > [Authorization Endpoint URL] | `OAUTH_SERVER_ISSUER`/authorize |
|token_endpoint| [Endpoints] > [Token] > [General] > [Token Endpoint URL] | `OAUTH_SERVER_ISSUER`/token |
|jwks_uri| [Key Management] > [Authorization Server] > [JWK Set Endpoint URI] | `OAUTH_SERVER_ISSUER`/jwks |

3. In the Authlete console sample client settings, add `OAUTH_SERVER_ISSUER`/sample-client under [Endpoints] > [Basic Settings] > [General] > [Redirect URIs]

After completing all settings, restart the development server with `npm run dev`.

Access `OAUTH_SERVER_ISSUER`/.well-known/openid-configuration and verify that `issuer`, `authorization_endpoint`, `token_endpoint`, and `jwks_uri` are updated to your configured values.

Also access `OAUTH_SERVER_ISSUER`/sample-client and confirm that token acquisition works.

> * As a workaround during development, you could edit metadata responses (e.g., authorization_endpoint) to use the http scheme, but in this session we publish over HTTPS.

Authorization server implementation is now complete.

## Next Step

[Verify the integration with VS Code](./03-call-mcp-tool-via-vscode.md)
