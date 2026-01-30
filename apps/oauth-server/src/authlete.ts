import { Authlete } from '@authlete/typescript-sdk';
import { config } from './config';

let authleteInstance: Authlete | null = null;

export const getAuthlete = () => {
  if (!authleteInstance) {
    authleteInstance = new Authlete({
      serverURL: config.authleteBaseUrl,
      bearer: config.authleteServiceAccessToken
    });
  }

  return authleteInstance;
};
