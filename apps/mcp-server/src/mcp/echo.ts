import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Registers the minimal Echo tool required by the reference implementation.
 */
export function registerEchoTool(server: McpServer) {
  server.registerTool(
    'echo',
    {
      title: 'Echo',
      description: 'Returns the same text that the caller supplies.',
      inputSchema: z.object({
        message: z
          .string()
          .min(1, 'message cannot be empty')
          .describe('Arbitrary text that the server should echo back.'),
      }),
    },
    async (input) => ({
      content: [
        {
          type: 'text',
          text: input.message,
        },
      ],
    }),
  );
}
