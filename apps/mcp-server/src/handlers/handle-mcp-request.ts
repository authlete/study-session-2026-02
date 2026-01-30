import type { StreamableHTTPTransport } from '@hono/mcp';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

type McpRequestHandlerOptions = {
  mcpServer: McpServer;
  transport: StreamableHTTPTransport;
};

const createMcpRequestHandler = ({ mcpServer, transport }: McpRequestHandlerOptions): MiddlewareHandler => {
  let isServerConnected = false;

  return async (c) => {
    try {
      if (!isServerConnected) {
        await mcpServer.connect(transport);
        isServerConnected = true;
      }
      const response = await transport.handleRequest(c);
      return response ?? c.newResponse(null, 204);
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.error('Unhandled MCP transport error', error);
      return c.json({ error: 'mcp_failure', message: 'Unable to process MCP request' }, 500);
    }
  };
};

export { createMcpRequestHandler };
