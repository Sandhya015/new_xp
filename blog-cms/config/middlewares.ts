import type { Core } from '@strapi/strapi';

/**
 * CORS for the public REST API (e.g. www.xpertintern.com → Strapi on Render).
 *
 * `strapi::cors` is **first** (outermost) so on the response path it runs **last**,
 * after Strapi’s default `strapi::security` (Helmet), so `Access-Control-Allow-Origin`
 * is not stripped for cross-origin API calls from the marketing site.
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
  const publicUrl = env('PUBLIC_URL', env('RENDER_EXTERNAL_URL', ''))
    .trim()
    .replace(/\/$/, '');
  const allowedSet = new Set([...defaults, ...fromEnv]);
  if (publicUrl) allowedSet.add(publicUrl);
  const allowed = [...allowedSet];

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

  // Use the built-in middleware string — do NOT pass a partial { config } here.
  // A partial config replaces Strapi’s full Helmet defaults (CSP, frameguard, …) and
  // can cause 500s; the admin then sees plain-text "Internal Server Error" and JSON parse fails.

  return [
    cors,
    'strapi::logger',
    'strapi::errors',
    'strapi::security',
    'strapi::poweredBy',
    'strapi::query',
    {
      name: 'strapi::body',
      config: {
        formLimit: '256mb',
        jsonLimit: '256mb',
        textLimit: '256mb',
        multipart: true,
        formidable: {
          maxFileSize: 60 * 1024 * 1024, // must be ≥ upload plugin sizeLimit
        },
      },
    },
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
