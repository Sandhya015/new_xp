import type { Core } from '@strapi/strapi';

/**
 * CORS for the public REST API (e.g. www.xpertintern.com → Strapi on Render).
 *
 * Important: `strapi::cors` must run **outermost** (listed **first**) so on the
 * response path it runs **after** `strapi::security` (Helmet). Otherwise Helmet
 * can run after CORS and drop `Access-Control-Allow-Origin` — browser shows
 * “blocked by CORS” even when the API returns 200.
 */
export default ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => {
  const raw = env('CORS_ORIGIN', '');
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://www.xpertintern.com',
    'https://xpertintern.com',
  ];
  const allowed = [...new Set([...defaults, ...fromEnv])];

  const cors: Core.Config.Middlewares[number] = {
    name: 'strapi::cors',
    config: {
      origin: (ctx: { request: { header: { origin?: string } } }): string | false => {
        const o = (ctx.request.header.origin || '').trim();
        if (!o) return false;
        if (allowed.includes(o)) return o;
        const trimmed = o.replace(/\/$/, '');
        if (allowed.includes(trimmed)) return o;
        return false;
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  };

  const security: Core.Config.Middlewares[number] = {
    name: 'strapi::security',
    config: {
      // Avoid CORP: same-origin blocking cross-origin fetch of API JSON in some browsers.
      crossOriginResourcePolicy: false,
    },
  };

  return [
    cors,
    'strapi::logger',
    'strapi::errors',
    security,
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
