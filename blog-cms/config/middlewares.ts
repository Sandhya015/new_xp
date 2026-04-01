import type { Core } from '@strapi/strapi';

/**
 * Browser CORS for the public REST API. Defaults include production + local dev;
 * merge with CORS_ORIGIN (comma-separated) for Vercel previews, etc.
 *
 * If CORS_ORIGIN is unset and we relied on default `strapi::cors`, some hosts
 * (e.g. Render) did not send Access-Control-Allow-Origin — browsers block fetch.
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
  const origins = [...new Set([...defaults, ...fromEnv])];

  const cors: Core.Config.Middlewares[number] = {
    name: 'strapi::cors',
    config: {
      enabled: true,
      origin: origins,
    },
  };

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
