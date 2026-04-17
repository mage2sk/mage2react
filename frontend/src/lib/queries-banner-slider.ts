import { panthQuery } from "./panth-db";

/**
 * queries-banner-slider.ts
 *
 * Reads `Panth_BannerSlider` content straight from the seeded `panth_banner_*`
 * tables. The Panth_BannerSlider module doesn't ship a GraphQL resolver, so
 * direct DB access is the simplest path to render admin-managed slides on
 * the Astro storefront.
 *
 * Never throws. Returns `{items:[]}` on any failure — callers just render
 * nothing in that case.
 */

export interface BannerSlideT {
  title?: string | null;
  subtitle?: string | null;
  image?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  alt?: string | null;
  priority?: number | null;
}

export type BannerSliderResult = {
  items: BannerSlideT[];
};

interface SlideRow {
  title: string | null;
  content_html: string | null;
  desktop_image: string | null;
  mobile_image: string | null;
  link_url: string | null;
  alt_text: string | null;
  sort_order: number | null;
}

const MEDIA_BASE = (process.env.PUBLIC_MEDIA_URL ?? "").replace(/\/+$/, "");

function absUrl(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s.length) return null;
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return s;
  if (MEDIA_BASE) return `${MEDIA_BASE}/${s.replace(/^\/+/, "")}`;
  return s;
}

function extractSubtitle(html: string | null): string | null {
  if (!html) return null;
  const m = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (m && m[1]) return m[1].replace(/<[^>]*>/g, "").trim();
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  return stripped.length > 0 ? stripped : null;
}

function extractTitleFromContent(html: string | null): string | null {
  if (!html) return null;
  const m = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (m && m[1]) return m[1].replace(/<[^>]*>/g, "").trim();
  return null;
}

export async function getBannerSlider(
  identifier: string = "home-hero",
): Promise<BannerSliderResult> {
  const sliderRows = await panthQuery<{ slider_id: number }>(
    "SELECT slider_id FROM panth_banner_slider WHERE identifier = ? AND is_active = 1 ORDER BY slider_id ASC LIMIT 1",
    [identifier],
  );
  const first = sliderRows[0];
  if (!first) return { items: [] };
  const sliderId = first.slider_id;

  const slides = await panthQuery<SlideRow>(
    `SELECT title, content_html, desktop_image, mobile_image, link_url, alt_text, sort_order
       FROM panth_banner_slide
      WHERE slider_id = ? AND is_active = 1
        AND (date_from IS NULL OR date_from <= CURDATE())
        AND (date_to IS NULL OR date_to >= CURDATE())
      ORDER BY sort_order ASC, slide_id ASC`,
    [sliderId],
  );

  const items: BannerSlideT[] = slides.map((r, idx) => {
    const headingFromHtml = extractTitleFromContent(r.content_html);
    return {
      title: (r.title ?? headingFromHtml ?? "").trim() || null,
      subtitle: extractSubtitle(r.content_html),
      image: absUrl(r.desktop_image ?? r.mobile_image),
      cta_label: r.link_url ? "Shop now" : null,
      cta_url: r.link_url,
      alt: r.alt_text ?? r.title ?? null,
      priority: slides.length - idx,
    };
  });

  return { items };
}
