import type { Core } from '@strapi/strapi';

/** Local uploads: max body size (must match strapi::body formidable.maxFileSize). */
const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Media storage:
 * - If AWS_S3_BUCKET + credentials are set → S3 (durable; best for Render free tier without a disk).
 * - Else → local public/uploads/ (wiped on deploy unless you mount a persistent disk).
 */
export default ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => {
  const bucket = env('AWS_S3_BUCKET', '').trim();
  const accessKeyId = env('AWS_ACCESS_KEY_ID', '').trim();
  const secretAccessKey = env('AWS_SECRET_ACCESS_KEY', '').trim();

  if (bucket && accessKeyId && secretAccessKey) {
    const region = env('AWS_REGION', 'ap-south-1').trim();
    const publicBase = env('AWS_S3_PUBLIC_URL', '').trim();
    // Full HTTPS base so DB stores S3 URLs, not /uploads/... on the Render host (which 404 after redeploy).
    const baseUrl =
      publicBase || `https://${bucket}.s3.${region}.amazonaws.com`;

    return {
      upload: {
        config: {
          sizeLimit: UPLOAD_MAX_BYTES,
          provider: 'aws-s3',
          providerOptions: {
            baseUrl,
            s3Options: {
              credentials: { accessKeyId, secretAccessKey },
              region,
              params: {
                Bucket: bucket,
                // "Bucket owner enforced" — omit ACL on PutObject (null skips header). Use bucket policy for GetObject.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider: null disables ACL
                ACL: null as any,
              },
            },
            // Smaller multipart defaults help low-memory Render instances during large uploads.
            providerConfig: {
              multipart: {
                partSize: 5 * 1024 * 1024,
                queueSize: 2,
              },
            },
          },
        },
      },
    };
  }

  return {
    upload: {
      config: {
        sizeLimit: UPLOAD_MAX_BYTES,
        provider: 'local',
        providerOptions: {},
      },
    },
  };
};
