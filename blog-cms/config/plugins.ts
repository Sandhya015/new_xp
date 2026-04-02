import type { Core } from '@strapi/strapi';

/** Local uploads: max body size (must match strapi::body formidable.maxFileSize). */
const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Local disk uploads (no S3). File bytes live under `public/uploads/` — on PaaS without a
 * persistent disk, that folder is wiped on redeploy; use UPLOADS_PERSIST_PATH + Docker entrypoint
 * or mount a volume on `public/uploads` (see .env.example).
 */
export default (): Core.Config.Plugin => ({
  upload: {
    config: {
      provider: 'local',
      providerOptions: {
        sizeLimit: UPLOAD_MAX_BYTES,
      },
    },
  },
});
