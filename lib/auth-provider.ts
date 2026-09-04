/**
 * Maps the non-sensitive connection prefix in an Auth0 subject to the label
 * users recognise in EquityIQ. The subject itself never leaves the server.
 */
export type AuthenticationProvider = "Google" | "LinkedIn" | "Company SSO";

export function getAuthenticationProvider(subject?: string): AuthenticationProvider | undefined {
  const connection = subject?.split("|", 1)[0];

  if (connection === "google-oauth2") return "Google";
  if (connection === "linkedin") return "LinkedIn";

  // EquityIQ's company connection is OIDC today. Keeping SAML here makes the
  // label stay accurate if the enterprise connection changes protocol later.
  if (connection === "oidc" || connection === "samlp" || connection === "equityiq-demo-okta") {
    return "Company SSO";
  }

  return undefined;
}
