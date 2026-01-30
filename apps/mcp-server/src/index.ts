import 'dotenv/config';

import { serve } from '@hono/node-server';
import { StreamableHTTPTransport, simpleMcpAuthRouter } from '@hono/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Hono } from 'hono';

import { PORT, config } from './config.js';
import { createMcpRequestHandler as mcpRequestHandler } from './handlers/handle-mcp-request.js';
import { registerEchoTool } from './mcp/echo.js';
import { registerGreetTool } from './mcp/greet.js';
import { createMcpGuard } from './mcp/mcp-guard.js';
import type { AccessTokenContext } from './auth/bearer-guard.js';

declare module 'hono' {
  interface ContextVariableMap {
    auth?: AccessTokenContext;
  }
}

const app = new Hono();

const bearerGuard = createMcpGuard(config);

app.use('/mcp', bearerGuard);

app.route(
  '/',
  simpleMcpAuthRouter({
    issuer: config.issuer,
    resourceServerUrl: new URL('/mcp', ensureTrailingSlash(config.baseMcpUrl)),
    serviceDocumentationUrl: config.documentationUrl ? new URL(config.documentationUrl) : undefined,
    scopesSupported: config.scopes,
    resourceName: config.resourceName,
  }),
);

const mcpServer = new McpServer({
  name: config.serverName,
  version: config.serverVersion,
});

registerEchoTool(mcpServer);
registerGreetTool(mcpServer);
const transport = new StreamableHTTPTransport({
  enableJsonResponse: true,
});

app.post('/mcp', mcpRequestHandler({ mcpServer, transport }));

const server = serve({
  fetch: app.fetch,
  port: PORT,
});

server.addListener('listening', () => {
  console.log(`mcp-server listening on http://localhost:${PORT}`);
});

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
