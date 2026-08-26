export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "configured demo inbox";
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}

/** One server-side view of email delivery readiness for session, health, and
 * delivery routes. It never exposes the configured address or credentials. */
export function getEmailDeliveryConfig() {
  const mode = process.env.EMAIL_DELIVERY_MODE === "production" ? "production" : "test" as const;
  const testRecipient = process.env.RESEND_TEST_RECIPIENT;
  const configured = Boolean(
    process.env.RESEND_API_KEY &&
    process.env.EMAIL_FROM &&
    (mode === "production" || testRecipient)
  );
  return { mode, configured, testRecipient };
}
