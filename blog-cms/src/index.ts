import type { Core } from '@strapi/strapi'

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * Grant Public role access to Article (steps 4–5: REST list + detail without login).
   * Idempotent: only creates missing permission rows.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
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
