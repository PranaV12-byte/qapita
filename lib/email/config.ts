export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "configured demo inbox";
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}@${domain}`;
}
