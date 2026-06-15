function normalizeOrigin(origin) {
  return origin.replace(/\/$/, '');
}

function parseOrigins(value) {
  if (!value) return [];
  return value.split(',').map((s) => normalizeOrigin(s.trim())).filter(Boolean);
}

function originToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '[^/]+');
  return new RegExp(`^${escaped}$`, 'i');
}

/** Vercel and Render frontend deployments */
const VERCEL_ORIGIN = /^https:\/\/[\w.-]+\.vercel\.app$/i;
const RENDER_ORIGIN = /^https:\/\/[\w.-]+\.onrender\.com$/i;

export function getCorsConfig(isProd) {
  const configured = parseOrigins(process.env.FRONTEND_URL);
  const patterns = configured.map(originToRegex);

  function isAllowed(origin) {
    if (!origin) return true;
    const normalized = normalizeOrigin(origin);

    if (!isProd) return true;

    if (configured.includes(normalized)) return true;
    if (patterns.some((re) => re.test(normalized))) return true;
    if (VERCEL_ORIGIN.test(normalized)) return true;
    if (RENDER_ORIGIN.test(normalized)) return true;

    return false;
  }

  return { configured, isAllowed };
}
