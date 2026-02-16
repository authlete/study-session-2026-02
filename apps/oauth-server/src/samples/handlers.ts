import type { Context } from 'hono';
import { html } from 'hono/html';
import {
    type AuthorizationFailResponse,
    type AuthorizationRequest,
    type AuthorizationResponse,
    type ClientLimitedAuthorization,
    type TokenRequest,
    type TokenResponse
} from '@authlete/typescript-sdk/dist/commonjs/models';
import type { AuthorizationSession } from '../types/session';
import type { User } from '../types/user';

const demoUser: User = {
    id: 'demo-user',
    claims: {
        family_name: 'Demo',
        given_name: 'Authlete',
        preferred_username: "Authlete Demo User"
    },
    consentedScopes: [],
};

export const authorizeHandler = async (c: Context) => {
    const { authlete, serviceId } = c.var;
    const parameters = await extractAuthorizationParameters(c);
    if (parameters === null) {
        return c.json(
            {
                error: 'invalid_request',
                error_description: 'Content-Type must be application/x-www-form-urlencoded'
            },
            400,
        );
    }
    const authorizationRequest: AuthorizationRequest = {
        parameters
    };

    const response: AuthorizationResponse = await authlete.authorization.processRequest({
        serviceId: serviceId,
        authorizationRequest
    });

    return handleAuthorizeAction(c, response);
};

async function extractAuthorizationParameters(c: Context): Promise<string | null> {
    if (c.req.method === 'POST') {
        const contentType = c.req.header('content-type') ?? '';
        if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
            return null;
        }
        return await c.req.text();
    }

    const { search } = new URL(c.req.url);
    return search.startsWith('?') ? search.slice(1) : '';
}

export const consentHandler = async (c: Context) => {
    const { authlete, serviceId } = c.var;
    const data = (await c.var.session.get()) as AuthorizationSession | null;
    const body = await c.req.parseBody();
    const decision = typeof body.decision === 'string' ? body.decision : '';
    console.log('Consent decision:', decision);
    if (!data || !data.authorization) {
        return c.json(
            {
                error: 'server_error',
                error_description: 'Authorization session not found'
            },
            500,
        );
    }

    if (decision !== 'approve') {
        c.var.session.update((prev) => ({
            ...prev,
            authorization: undefined,
        } satisfies AuthorizationSession));
        const failResponse = await authlete.authorization.fail({
            serviceId,
            authorizationFailRequest: {
                ticket: data.authorization.ticket,
                reason: 'DENIED',
                description: 'User denied the authorization request'
            }
        })

        return handleFailAction(c, failResponse);

    } if (!data.authorization.ticket) {
        return c.json(
            {
                error: 'server_error',
                error_description: 'Authorization ticket not found'
            },
            500,
        );
    }

    const issueResponse = await authlete.authorization.issue({
        serviceId,
        authorizationIssueRequest: {
            ticket: data.authorization.ticket,
            subject: demoUser.id,
            claims: JSON.stringify(demoUser.claims),
            jwtAtClaims: JSON.stringify(demoUser.claims),
            scopes: data.authorization.scopesToConsent
        }
    });
    switch (issueResponse.action) {
        case 'LOCATION':
            if (issueResponse.responseContent) {
                return c.redirect(issueResponse.responseContent);
            }
            return c.json(
                {
                    error: 'server_error',
                    error_description: 'Authorization issue response missing redirect location'
                },
                500,
            );
        case 'BAD_REQUEST':
            return c.json(
                {
                    error: 'server_error',
                    error_description: issueResponse.resultMessage || 'Failed to issue authorization'
                },
                500,
            );
        default:
            return c.json(
                {
                    error: 'server_error',
                    error_description: `Unsupported action: ${issueResponse.action}`
                },
                500,
            );
    }

};

export const tokenHandler = async (c: Context) => {
    const { authlete, serviceId } = c.var;
    const parameters = await c.req.text();
    const authHeader = c.req.header('authorization');
    const credentials = parseBasicCredentials(authHeader);

    const tokenRequest: TokenRequest = {
        parameters,
        clientId: credentials?.clientId,
        clientSecret: credentials?.clientSecret,
    };

    const response = await authlete.token.process({
        serviceId,
        tokenRequest,
    });

    return handleTokenAction(c, response, authHeader);
};

export const openIdConfigHandler = async (c: Context) => {
    const { authlete, serviceId } = c.var;
    const config = await authlete.service.getConfiguration({
        serviceId
    })
    return c.json(config)
};

export const jwksHandler = async (c: Context) => {
    const { authlete, serviceId } = c.var;
    const jwks = await authlete.jwkSetEndpoint.serviceJwksGetApi({
        serviceId
    });
    return c.json(jwks);
};

async function handleAuthorizeAction(
    c: Context,
    response: AuthorizationResponse
) {
    const { authlete, serviceId } = c.var;
    const responseContent = response.responseContent ?? '';
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');

    switch (response.action) {
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
            const authorizationSession = response.ticket
                ? {
                      ticket: response.ticket,
                      scopesToConsent: response.scopes
                          ?.map((scope) => scope.name)
                          .filter((scope): scope is string => Boolean(scope)) ?? [],
                  }
                : undefined;
            await c.var.session.update((prev) => ({
                ...prev,
                authorization: authorizationSession,
            } satisfies AuthorizationSession));
            return renderConsent(c, response);
        case 'NO_INTERACTION':
            const errorResponse = await authlete.authorization.fail({
                serviceId,
                authorizationFailRequest: {
                    ticket: response.ticket!,
                    reason: 'SERVER_ERROR',
                    description: 'prompt=none is not supported in this sample server'
                }
            });
            return handleFailAction(c, errorResponse);
        default:
            c.header('Content-Type', 'application/json');
            return c.body('', 500);
    }
}

async function renderConsent(
    c: Context,
    response: AuthorizationResponse
) {
    const clientName = response.client?.clientName || 'Unknown Client';
    const clientId = resolveClientId(response) || 'unknown-client-id';
    const scopes = response.scopes ?? [];
    const resources = response.resources ?? [];

    return c.html(html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Consent</title>
  </head>
  <body>
    <main>
      <h1>Consent</h1>
      <p>Client: ${clientName}</p>
      <p>Client ID: ${clientId}</p>
      <h2>Scopes</h2>
      ${
        scopes.length === 0
          ? html`<p>No scopes requested.</p>`
          : html`<ul>${scopes.map((scope) => html`<li>${scope.name}: ${scope.description}</li>`)}</ul>`
      }
      <h2>Resources</h2>
      ${
        resources.length === 0
          ? html`<p>No resources requested.</p>`
          : html`<ul>${resources.map((resource) => html`<li>${resource}</li>`)}</ul>`
      }
      <form method="post" action="/consent" style="margin-top: 12px;">
      <button type="submit" name="decision" value="approve">Log in and approve</button>
      <button type="submit" name="decision" value="deny">Deny</button>
      </form>
    </main>
  </body>
</html>`);
}

function resolveClientId(info: AuthorizationResponse) {
    if (!info.client) {
        return null;
    }
    const client: ClientLimitedAuthorization = info.client;
    switch (client.clientSource) {
        case 'AUTOMATIC_REGISTRATION':
        case 'EXPLICIT_REGISTRATION':
            if (client.entityId) {
                return client.entityId;
            } else {
                throw new Error('Client entityId is missing');
            }
        case 'METADATA_DOCUMENT':
            return client.metadataDocumentLocation;
        case 'DYNAMIC_REGISTRATION':
        case 'STATIC_REGISTRATION':
            return client.clientIdAlias;
        default:
            return client.clientIdAlias;
    }
}

function handleFailAction(c: Context, response: AuthorizationFailResponse) {
    const responseContent = response.responseContent ?? '';
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');

    switch (response.action) {
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
        default:
            c.header('Content-Type', 'application/json');
            return c.body('', 500);
    }
}

function handleTokenAction(c: Context, response: TokenResponse, authHeader: string | undefined) {
    const responseContent = response.responseContent ?? '';
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');

    switch (response.action) {
        case 'INTERNAL_SERVER_ERROR':
            c.header('Content-Type', 'application/json');
            return c.body(responseContent, 500);
        case 'INVALID_CLIENT': {
            c.header('Content-Type', 'application/json');
            if (authHeader?.toLowerCase().startsWith('basic ')) {
                c.header('WWW-Authenticate', 'Basic realm="token"');
                return c.body(responseContent, 401);
            }
            return c.body(responseContent, 400);
        }
        case 'BAD_REQUEST':
            c.header('Content-Type', 'application/json');
            return c.body(responseContent, 400);
        case 'OK':
            c.header('Content-Type', 'application/json');
            return c.body(responseContent, 200);
        case 'PASSWORD':
        case 'TOKEN_EXCHANGE':
        case 'JWT_BEARER':
            return c.json(
                {
                    error: 'server_error',
                    error_description: ` ${response.action} grant type is not supported in this sample server`
                },
                501,
            );
        default:
            c.header('Content-Type', 'application/json');
            return c.body('', 500);
    }
}

function parseBasicCredentials(authHeader: string | undefined) {
    if (!authHeader || !authHeader.toLowerCase().startsWith('basic ')) {
        return null;
    }

    try {
        const encoded = authHeader.slice(6).trim();
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        const separatorIndex = decoded.indexOf(':');
        if (separatorIndex === -1) {
            return null;
        }
        return {
            clientId: decoded.slice(0, separatorIndex),
            clientSecret: decoded.slice(separatorIndex + 1),
        };
    } catch {
        return null;
    }
}
