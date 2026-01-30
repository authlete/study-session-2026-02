import { createBearerGuard } from '../auth/bearer-guard.js';
import { createTokenVerifier } from '../auth/token-verifier.js';

type McpGuardConfig = {
  issuer: string;
  audience: string;
  scopes: string[];
};

const createMcpGuard = ({ issuer, audience, scopes }: McpGuardConfig) =>
  createBearerGuard({
    verifyToken: createTokenVerifier({
      issuer,
      audience,
    }),
    requiredScopes: scopes,
  });

export { createMcpGuard };
