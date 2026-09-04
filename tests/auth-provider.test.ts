import { describe, expect, it } from "vitest";
import { getAuthenticationProvider } from "../lib/auth-provider";

describe("authentication provider labels", () => {
  it.each([
    ["google-oauth2|123", "Google"],
    ["linkedin|123", "LinkedIn"],
    ["oidc|123", "Company SSO"],
    ["samlp|123", "Company SSO"],
  ])("maps %s without exposing the Auth0 subject", (subject, expected) => {
    expect(getAuthenticationProvider(subject)).toBe(expected);
  });

  it("does not invent a provider for an unrecognised subject", () => {
    expect(getAuthenticationProvider("auth0|123")).toBeUndefined();
    expect(getAuthenticationProvider()).toBeUndefined();
  });
});
