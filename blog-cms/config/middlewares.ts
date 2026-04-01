import type { Core } from '@strapi/strapi';

/**
 * Allow browser requests from your frontend (e.g. Vercel).
 * On Render, set CORS_ORIGIN to a comma-separated list, no spaces (or trim-safe):
 *   https://your-app.vercel.app,https://www.yourdomain.com
 * Omit to keep Strapi’s default CORS behavior.
 */
export default ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => {
  const raw = env('CORS_ORIGIN', '');
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const cors: Core.Config.Middlewares[number] =
    origins.length > 0
      ? {
          name: 'strapi::cors',
          config: {
            enabled: true,
            origin: origins,
          },
        }
      : 'strapi::cors';

  return [
    'strapi::logger',
    'strapi::errors',
    'strapi::security',
    cors,
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
