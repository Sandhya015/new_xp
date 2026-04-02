import type { Core } from '@strapi/strapi';
import { extendMiddlewareConfiguration } from '@strapi/utils';

/**
 * Origins to allow in CSP for Media Library when using S3 (admin img-src / media-src).
 */
function s3CspOrigins(env: Core.Config.Shared.ConfigParams['env']): string[] {
  const bucket = env('AWS_S3_BUCKET', '').trim();
  const accessKeyId = env('AWS_ACCESS_KEY_ID', '').trim();
  const secretAccessKey = env('AWS_SECRET_ACCESS_KEY', '').trim();
  if (!bucket || !accessKeyId || !secretAccessKey) return [];

  const region = env('AWS_REGION', 'ap-south-1').trim();
  const publicBase = env('AWS_S3_PUBLIC_URL', '').trim();
  const origins = new Set<string>();
  if (publicBase) {
    try {
      origins.add(new URL(publicBase).origin);
    } catch {
      /* invalid URL — ignore */
    }
  }
  origins.add(`https://${bucket}.s3.${region}.amazonaws.com`);
  return [...origins];
}

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
  if (publicUrl) {
    allowedSet.add(publicUrl);
    allowedSet.add(`${publicUrl}/`);
  }
  const allowed = [...allowedSet];

  const cors: Core.Config.Middlewares[number] = {
    name: 'strapi::cors',
    config: {
      // Use a string[] — not a function returning `false`. Strapi's matchOrigin() only
      // treats function results as strings to .split(); `false` caused TypeError → 500 on /admin/login.
      origin: allowed,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  };

  const base: Core.Config.Middlewares = [
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

  const s3Origins = s3CspOrigins(env);
  if (s3Origins.length === 0) {
    return base;
  }

  // Merge S3 hosts into CSP img-src / media-src so admin can show S3 thumbnails (default CSP is only 'self' + market-assets).
  return extendMiddlewareConfiguration(
    base as (string | { name?: string; config?: unknown })[],
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'img-src': s3Origins,
            'media-src': s3Origins,
          },
        },
      },
    }
  );
};
