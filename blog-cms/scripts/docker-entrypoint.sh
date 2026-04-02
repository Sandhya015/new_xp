#!/bin/sh
set -e
cd /opt/app

# Optional: persistent volume path (e.g. Render disk mounted at /var/data/strapi-uploads).
# Replaces public/uploads with a symlink so binaries survive redeploys without S3.
if [ -n "${UPLOADS_PERSIST_PATH:-}" ]; then
  mkdir -p "${UPLOADS_PERSIST_PATH}"
  if [ ! -L public/uploads ]; then
    rm -rf public/uploads
    ln -sfn "${UPLOADS_PERSIST_PATH}" public/uploads
  fi
fi

exec "$@"
