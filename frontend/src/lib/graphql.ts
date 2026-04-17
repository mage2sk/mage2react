import { GraphQLClient } from "graphql-request";

// Server-side (SSR / Astro endpoints / middleware) hits Magento over the
// internal Docker network: `http://mage2react.local/graphql` via alias.
// Browser-side code must use a same-origin path; Traefik routes `/graphql`
// to the Magento nginx container (priority 100 rule).
const isBrowser = typeof window !== "undefined";

const endpoint = isBrowser
  ? `${window.location.origin}/api/graphql`
  : (import.meta.env.MAGENTO_GRAPHQL_URL ?? "http://mage2react.local/graphql");

export const gql = new GraphQLClient(endpoint, {
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "mage2react-frontend",
    "Store": "default",
  },
  fetch: globalThis.fetch,
});

export async function query<T>(
  document: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return gql.request<T>(document, variables);
}
