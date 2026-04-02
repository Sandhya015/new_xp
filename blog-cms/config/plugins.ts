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
    return {
      upload: {
        config: {
          sizeLimit: UPLOAD_MAX_BYTES,
          provider: 'aws-s3',
          providerOptions: {
            baseUrl: env('AWS_S3_PUBLIC_URL', '').trim() || undefined,
            s3Options: {
              credentials: { accessKeyId, secretAccessKey },
              region: env('AWS_REGION', 'ap-south-1').trim(),
              params: {
                Bucket: bucket,
                // New buckets use "Bucket owner enforced" — default public-read ACL causes AccessControlListNotSupported.
                // `ACL` key present but null → no ACL header on PutObject; use bucket policy for public reads.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider accepts null to skip ACL
                ACL: null as any,
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
