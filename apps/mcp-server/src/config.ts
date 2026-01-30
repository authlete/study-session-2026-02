const PORT = Number(process.env.MCP_PORT ?? 9001);

const issuer = (process.env.OAUTH_SERVER_ISSUER ?? '').replace(/\/$/, '') || 'http://localhost:9000';
const baseMcpUrl = process.env.MCP_BASE_URL ?? `http://localhost:${PORT}`;

const config = {
  issuer,
  audience: `${baseMcpUrl.replace(/\/$/, '')}/mcp`,
  baseMcpUrl,
  documentationUrl: process.env.MCP_SERVICE_DOCUMENTATION_URL,
  scopes: process.env.MCP_SCOPES?.split(',').map((scope) => scope.trim()).filter(Boolean) ?? [],
  resourceName: process.env.MCP_RESOURCE_NAME ?? 'Echo MCP Server',
  serverName: process.env.MCP_SERVER_NAME ?? 'authlete-mcp-server',
  serverVersion: process.env.MCP_SERVER_VERSION ?? '0.1.0',
};

export { PORT, config };
