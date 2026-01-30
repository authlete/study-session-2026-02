const PORT = Number(process.env.OAUTH_PORT ?? 9000);
const SESSION_SECRET =
  process.env.AUTH_SECRET ??
  '0000000000000000000000000000000000000000000000000000000000000000';

const config = {
  port: PORT,
  sessionSecret: SESSION_SECRET,
  authleteBaseUrl: process.env.AUTHLETE_BASE_URL,
  authleteServiceAccessToken: process.env.AUTHLETE_SERVICE_ACCESSTOKEN,
  authleteServiceApiKey: process.env.AUTHLETE_SERVICE_APIKEY ?? '',
  mcpScopes: process.env.MCP_SCOPES ?? '',
};

const warnMissing = (name: string, value: string | undefined) => {
  if (!value) {
    console.warn(`${name} is not set.`);
  }
};

warnMissing('AUTHLETE_BASE_URL', config.authleteBaseUrl);
warnMissing('AUTHLETE_SERVICE_ACCESSTOKEN', config.authleteServiceAccessToken);
warnMissing('AUTHLETE_SERVICE_APIKEY', config.authleteServiceApiKey);

export { config };
