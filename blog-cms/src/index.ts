import type { Core } from '@strapi/strapi'

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * Grant Public role access to Article (steps 4–5: REST list + detail without login).
   * Idempotent: only creates missing permission rows.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Strapi defaults upload.settings.responsiveDimensions=true → many Sharp resizes + parallel S3 puts.
    // That often OOMs small Render instances → POST /upload 502 + empty JSON body in admin.
    // Opt back in: set UPLOAD_RESPONSIVE=true on the host.
    const allowResponsive =
      process.env.UPLOAD_RESPONSIVE === 'true' || process.env.UPLOAD_RESPONSIVE === '1'
    if (!allowResponsive) {
      try {
        const uploadSvc = strapi.plugin('upload').service('upload') as {
          getSettings: () => Promise<Record<string, unknown> | undefined>
          setSettings: (v: Record<string, unknown>) => Promise<unknown>
        }
        const cur = (await uploadSvc.getSettings()) ?? {}
        await uploadSvc.setSettings({
          sizeOptimization: typeof cur.sizeOptimization === 'boolean' ? cur.sizeOptimization : true,
          responsiveDimensions: false,
          autoOrientation: typeof cur.autoOrientation === 'boolean' ? cur.autoOrientation : false,
          aiMetadata: typeof cur.aiMetadata === 'boolean' ? cur.aiMetadata : true,
        })
        strapi.log.info(
          '[blog-cms] Upload: responsiveDimensions=false (set UPLOAD_RESPONSIVE=true to allow large/medium/small variants).'
        )
      } catch (e) {
        strapi.log.warn(`[blog-cms] Upload settings tweak skipped: ${e}`)
      }
    }

    const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' },
    })
    if (!publicRole) {
      strapi.log.warn('[blog-cms] Public role not found; skip Article permissions.')
      return
    }

    const actions = [
      'api::article.article.find',
      'api::article.article.findOne',
    ] as const

    for (const action of actions) {
      const exists = await strapi.db.query('plugin::users-permissions.permission').findOne({
        where: { action, role: publicRole.id },
      })
      if (!exists) {
        await strapi.db.query('plugin::users-permissions.permission').create({
          data: { action, role: publicRole.id },
        })
        strapi.log.info(`[blog-cms] Public permission enabled: ${action}`)
      }
    }
  },
}
