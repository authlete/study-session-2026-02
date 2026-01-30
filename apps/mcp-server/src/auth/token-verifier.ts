import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

type AuthorizationServerMetadata = {
  jwks_uri?: string;
};

type TokenVerifierConfig = {
  issuer: string;
  audience: string;
};

const WELL_KNOWN_PATHS = [
  '/.well-known/oauth-authorization-server',
  '/.well-known/openid-configuration',
];

export function createTokenVerifier(config: TokenVerifierConfig) {
  let jwksPromise: Promise<ReturnType<typeof createRemoteJWKSet> | null> | null = null;
  let jwksUriPromise: Promise<string | null> | null = null;

  return async (token: string): Promise<JWTPayload> => {
    if (!jwksPromise) {
      jwksPromise = resolveJwks(config.issuer, () => {
        if (!jwksUriPromise) {
          jwksUriPromise = resolveJwksUri(config.issuer);
        }
        return jwksUriPromise;
      });
    }
    const jwks = await jwksPromise;
    if (!jwks) {
      jwksPromise = null;
      jwksUriPromise = null;
      throw new Error('JWKS is unavailable');
    }
    console.log(`Verifying token issued by ${config.issuer} for audience ${config.audience}`);

    // For debugging purposes
    console.log(`Token: ${token}`);
    const jwksUri = await jwksUriPromise;
    if (jwksUri) {
      console.log(`Using JWKS URI: ${jwksUri}`);
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.audience,
    });
    return payload;
  };
}

async function resolveJwks(issuer: string, getCachedUri: () => Promise<string | null>) {
  const cachedUri = await getCachedUri();
  if (!cachedUri) {
    return null;
  }
  return createRemoteJWKSet(new URL(cachedUri));
}

async function resolveJwksUri(issuer: string) {
  for (const path of WELL_KNOWN_PATHS) {
    const metadataUrl = new URL(path, ensureTrailingSlash(issuer));
    try {
      const response = await fetch(metadataUrl, { headers: { accept: 'application/json' } });
      if (!response.ok) {
        continue;
      }
      const metadata = (await response.json()) as AuthorizationServerMetadata;
      if (metadata?.jwks_uri) {
        console.log(`Discovered JWKS URI: ${metadata.jwks_uri}`);
        return metadata.jwks_uri;
      }
    } catch (error) {
      console.warn(`Failed to load metadata from ${metadataUrl.href}`, error);
    }
  }

  return null;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
