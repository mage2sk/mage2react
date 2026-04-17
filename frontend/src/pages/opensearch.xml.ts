/**
 * /opensearch.xml — OpenSearch description document.
 *
 * SEO rule satisfied:
 *   Browser autodiscovery of an in-site search engine. When paired with
 *   <link rel="search" type="application/opensearchdescription+xml"> in the
 *   document head, browsers expose a one-click "Add search engine" affordance
 *   (address-bar keyword search, Chrome/Edge tab-search, Firefox search bar).
 *   Also helps Google surface the sitelinks search box faster by reinforcing
 *   the SearchAction JSON-LD already emitted on the home page.
 *
 *   Spec: https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md
 */

import type { APIRoute } from "astro";

export const prerender = false;

const SHORT_NAME = "mage2react";
const DESCRIPTION = "Search the mage2react catalog";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = () => {
  const siteUrlRaw = import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321";
  const siteUrl = siteUrlRaw.replace(/\/+$/, "");

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">\n` +
    `  <ShortName>${xmlEscape(SHORT_NAME)}</ShortName>\n` +
    `  <Description>${xmlEscape(DESCRIPTION)}</Description>\n` +
    `  <InputEncoding>UTF-8</InputEncoding>\n` +
    `  <Image width="16" height="16" type="image/svg+xml">${xmlEscape(siteUrl)}/favicon.svg</Image>\n` +
    `  <Url type="text/html" method="get" template="${xmlEscape(siteUrl)}/search?q={searchTerms}" />\n` +
    `  <Url type="application/opensearchdescription+xml" rel="self" template="${xmlEscape(siteUrl)}/opensearch.xml" />\n` +
    `  <moz:SearchForm xmlns:moz="http://www.mozilla.org/2006/browser/search/">${xmlEscape(siteUrl)}/search</moz:SearchForm>\n` +
    `</OpenSearchDescription>\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/opensearchdescription+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
