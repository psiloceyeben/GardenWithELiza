const loopback = (ip: string | undefined): boolean => !!ip && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
function parseOrigin(value: string): URL | null {
  try {
    const u = new URL(value);
    return ['http:', 'https:'].includes(u.protocol) && value === u.origin ? u : null;
  } catch { return null; }
}

/** Browser origin defense only: native clients can omit or forge Origin. */
export function originPolicy(publicBase: string, additional = ''): (origin: string | undefined, remoteAddress?: string) => boolean {
  const base = new URL(publicBase);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid PONS_PUBLIC_BASE');
  const allowed = new Set([base.origin]);
  for (const entry of additional.split(',').map(s => s.trim()).filter(Boolean)) {
    if (!parseOrigin(entry)) throw new Error('PONS_ALLOWED_ORIGINS requires exact HTTP(S) origins');
    allowed.add(entry);
  }
  return (origin, remoteAddress) => {
    if (origin === undefined) return true; // CLI bots: identity auth still required
    const u = parseOrigin(origin); if (!u) return false;
    if (allowed.has(u.origin)) return true;
    // SSH-forwarded local previews connect from loopback. Never trust forwarded
    // address headers or accept arbitrary localhost Origins from the public net.
    return loopback(remoteAddress) && u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  };
}
