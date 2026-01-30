import 'dotenv/config';

import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors'
import { type Session, useSession, useSessionStorage, type Storage } from '@hono/session';
import { serve } from '@hono/node-server';
import type { AuthorizationSession } from './types/session';
import {
  authorizeHandler,
  consentHandler,
  jwksHandler,
  openIdConfigHandler,
  tokenHandler,
} from './samples/handlers';
import { getAuthlete } from './authlete';
import { config } from './config';
import { sampleClientHandler } from './samples/client';

const app = new Hono();
const PORT = config.port;
const SESSION_SECRET = config.sessionSecret;

declare module 'hono' {
  interface ContextVariableMap {
    session: Session<AuthorizationSession>;
    authlete: ReturnType<typeof getAuthlete>;
    serviceId: string;
  }
}

const sessionStore = new Map<string, AuthorizationSession>();
const sessionStorage: Storage<AuthorizationSession> = {
  get: (sid) => sessionStore.get(sid) ?? null,
  set: (sid, value) => {
    sessionStore.set(sid, value);
  },
  delete: (sid) => {
    sessionStore.delete(sid);
  },
};

app.use(useSessionStorage(sessionStorage));
app.use(
  useSession({
    secret: SESSION_SECRET,
  }),
);
app.use(async (c, next) => {
  const serviceId = config.authleteServiceApiKey;
  c.set('authlete', getAuthlete());
  c.set('serviceId', serviceId);
  await next();
});

const corsHandler = cors({
  origin: (origin) => origin,
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ["DPoP", "Authorization", "Content-Type"]
})

app.use('/token', corsHandler)
app.use('/userinfo', corsHandler)
app.use('/jwks', cors())
app.use('/.well-known/*', cors())

app.get('/', (c: Context) =>
  c.json({
    service: 'oauth-server',
    status: 'ok',
    note: 'Development stub running over http',
  }));

app.get('/sample-client', sampleClientHandler);

app.get('/authorize', async (c: Context) => {
  console.log('GET /authorize called');

  // implement authorization endpoint logic here
  const { authlete, serviceId } = c.var;
  const parameters = c.req.url.split('?')[1] ?? '';
  // const authorizationRequest: AuthorizationRequest = {
  //   parameters
  // };

  // const response: AuthorizationResponse = await authlete.authorization.processRequest({
  //   serviceId: serviceId,
  //   authorizationRequest
  // });
  // ...
  return c.json({ error: 'not_implemented' }, 501)
}
);

app.post('/consent', async (c: Context) => c.json({ error: 'not_implemented' }, 501));

app.post('/token', async (c: Context) => c.json({ error: 'not_implemented' }, 501));

app.get('/jwks', async (c: Context) => c.json({ error: 'not_implemented' }, 501));

app.get('/.well-known/openid-configuration', async (c: Context) =>
  c.json({ error: 'not_implemented' }, 501));

const server = serve({
  fetch: app.fetch,
  port: PORT,
});

server.addListener('listening', () => {
  console.log(`oauth-server listening on http://localhost:${PORT}`);
});
