import type { Core } from '@strapi/strapi';

/** Default local provider sizeLimit is 1 MB — larger files 500 with non-JSON body → admin "Unexpected token 'I'…". */
const UPLOAD_MAX_BYTES = 50 * 1024 * 1024; // 50 MB (keep in sync with strapi::body formidable.maxFileSize)

const config = (_params: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  upload: {
    config: {
      provider: 'local',
      providerOptions: {
        sizeLimit: UPLOAD_MAX_BYTES,
      },
    },
  },
});

export default config;
