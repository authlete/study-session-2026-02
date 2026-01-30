export type AuthorizationSession = {
  authorization?: {
    ticket: string;
    scopesToConsent: string[];
  };
};
