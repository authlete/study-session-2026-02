export type User = {
  id: string;
  claims: Record<string, string>;
  consentedScopes: string[];
};
