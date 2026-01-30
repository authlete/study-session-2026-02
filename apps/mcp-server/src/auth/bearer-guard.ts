import type { Context, MiddlewareHandler } from 'hono';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export type TokenClaims = {
  scope?: string | string[];
  scp?: string | string[];
  [key: string]: unknown;
};

export type AccessTokenContext = AuthInfo;

type ScopeClaim = string | string[] | undefined;

export type BearerGuardOptions = {
  verifyToken: (token: string) => Promise<TokenClaims>;
  requiredScopes: string[];
};

export function createBearerGuard(options: BearerGuardOptions): MiddlewareHandler {
  return async (c, next) => {
    const respond = (status: number, error: string, description: string) => {
      const baseUrl = getBaseUrl(c);
      const scopeAttribute = options.requiredScopes.length > 0 ? `, scope="${options.requiredScopes.join(' ')}"` : '';
      const header = `Bearer realm="${baseUrl}", error="${error}", error_description="${description}", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp"${scopeAttribute}`;
      c.header('WWW-Authenticate', header);
      return c.json({ error, error_description: description }, status as 401 | 403);
    };

    const authHeader = c.req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return respond(401, 'invalid_request', 'Access token is required');
    }

    const token = authHeader.substring('Bearer '.length).trim();
    if (!token) {
      return respond(401, 'invalid_request', 'Access token is required');
    }

    try {
      const payload = await options.verifyToken(token);
      const scopes = Array.from(extractScopes(payload.scope as ScopeClaim, payload['scp'] as ScopeClaim));
      const clientId = resolveClientId(payload);
      const expiresAt = typeof payload.exp === 'number' ? payload.exp : undefined;
      const authInfo: AccessTokenContext = {
        token,
        clientId,
        scopes,
        expiresAt,
        extra: { payload },
      };
      c.set('auth', authInfo);
      if (!hasRequiredScopes(payload, options.requiredScopes)) {
        return respond(403, 'insufficient_scope', `The request requires higher privileges than provided. Required scopes: ${options.requiredScopes.join(', ')}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`token: ${token}`);
      console.warn(`Access token verification failed: ${message}`);
      return respond(401, 'invalid_token', 'The access token provided is expired, revoked, malformed, or invalid');
    }

    await next();
  };
}

function getBaseUrl(c: Context) {
  const requestUrl = new URL(c.req.url);
  return `${requestUrl.protocol}//${requestUrl.host}`;
}

function hasRequiredScopes(payload: TokenClaims, requiredScopes: string[]) {
  if (requiredScopes.length === 0) {
    return true;
  }

  const tokenScopes = extractScopes(payload.scope as ScopeClaim, payload['scp'] as ScopeClaim);
  return requiredScopes.every((scope) => tokenScopes.has(scope));
}

function extractScopes(scopeClaim?: ScopeClaim, scpClaim?: ScopeClaim) {
  const scopes = new Set<string>();
  const add = (value?: ScopeClaim) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item) => scopes.add(String(item)));
    } else {
      value
        .split(' ')
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => scopes.add(item));
    }
  };

  add(scopeClaim);
  add(scpClaim);
  return scopes;
}

function resolveClientId(payload: TokenClaims) {
  const candidates = ['client_id', 'clientId', 'azp', 'sub'];
  for (const key of candidates) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return 'unknown';
}
