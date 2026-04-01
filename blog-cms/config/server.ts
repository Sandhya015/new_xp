import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => {
  const publicUrl = env('PUBLIC_URL') || env('RENDER_EXTERNAL_URL');
  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    app: {
      keys: env.array('APP_KEYS'),
    },
    ...(publicUrl
      ? {
          url: publicUrl,
          proxy: env.bool('PROXY', true),
        }
      : {}),
  };
};

export default config;
