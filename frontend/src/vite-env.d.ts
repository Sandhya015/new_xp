/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** Strapi origin for blog CMS, e.g. http://localhost:1337 */
  readonly VITE_STRAPI_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
