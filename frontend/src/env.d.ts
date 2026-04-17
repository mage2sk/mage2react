/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly MAGENTO_GRAPHQL_URL: string;
  readonly MAGENTO_INTERNAL_HOST?: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_MEDIA_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
