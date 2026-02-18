import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const PREFERRED_USERNAME_KEYS = ['preferred_username']
const FIRST_NAME_KEYS = ['given_name'];
const LAST_NAME_KEYS = ['family_name'];

export function registerGreetTool(server: McpServer) {
  const registerTool = server.registerTool.bind(server) as unknown as (
    name: string,
    metadata: { title: string; description: string; inputSchema: unknown },
    handler: (args: unknown, extra: { authInfo?: { extra?: Record<string, unknown> } }) => Promise<{
      content: { type: 'text'; text: string }[];
    }>,
  ) => void;
  const inputSchema = z.object({}).describe('No input.');
  registerTool(
    'greet',
    {
      title: 'Greet',
      description: 'Returns a greeting using the first and last name from the access token.',
      inputSchema,
    },
    async (_input, extra) => {
      const payload = (extra.authInfo?.extra?.payload ?? {}) as Record<string, unknown>;

      let preferredUsername = findStringClaim(payload, PREFERRED_USERNAME_KEYS);
      if (!preferredUsername) {
        const firstName = findStringClaim(payload, FIRST_NAME_KEYS);
        const lastName = findStringClaim(payload, LAST_NAME_KEYS);
        if (!firstName || !lastName) {
          throw new Error('preferred_username or first and last name claims are required');
        }
        preferredUsername = `${firstName} ${lastName}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `hello ${preferredUsername}!`,
          },
        ],
      };
    },
  );
}

function findStringClaim(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}
