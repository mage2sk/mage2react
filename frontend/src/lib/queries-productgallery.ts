import { z } from "zod";

/**
 * queries-productgallery.ts
 *
 * Helpers for `Panth_Productgallery` (`mage2kishan/module-productgallery`).
 * The parent module contributes a `panth_gallery { images {...} }` field to
 * `ProductInterface`. We do not own that schema, so:
 *   - Every field is `.nullable().optional()`.
 *   - Callers splice `...PanthGalleryProductFragment` into their PDP query.
 *   - `extractPanthGallery` safe-parses and returns `[]` on any mismatch.
 */

/* -------------------------------------------------------------------------- */
/* GraphQL fragment                                                           */
/* -------------------------------------------------------------------------- */

export const PANTH_GALLERY_PRODUCT_FRAGMENT = /* GraphQL */ `
  fragment PanthGalleryProductFragment on ProductInterface {
    panth_gallery {
      images {
        url
        label
        zoom_url
        video_url
        poster
        position
        is_video
      }
    }
  }
`;

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
/* -------------------------------------------------------------------------- */

const PanthGalleryImage = z.object({
  url: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  zoom_url: z.string().nullable().optional(),
  video_url: z.string().nullable().optional(),
  poster: z.string().nullable().optional(),
  position: z.number().nullable().optional(),
  is_video: z.boolean().nullable().optional(),
});

export type PanthGalleryImageT = {
  url: string;
  label: string;
  zoomUrl: string | null;
  videoUrl: string | null;
  poster: string | null;
  isVideo: boolean;
  position: number;
};

const ProductWithGallery = z.object({
  panth_gallery: z
    .object({
      images: z.array(PanthGalleryImage).nullable().optional(),
    })
    .nullable()
    .optional(),
});

/* -------------------------------------------------------------------------- */
/* Extractor                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Safe-parse the `panth_gallery.images` list off any product-shaped object.
 * Returns `[]` on any mismatch / when the parent module is not installed.
 * Sorted by `position` (ascending); entries with no `url` are dropped.
 */
export function extractPanthGallery(product: unknown): PanthGalleryImageT[] {
  const parsed = ProductWithGallery.safeParse(product);
  if (!parsed.success) return [];
  const raw = parsed.data.panth_gallery?.images ?? [];
  const cleaned: PanthGalleryImageT[] = [];
  for (const r of raw) {
    const url = (r.url ?? "").trim();
    if (!url) continue;
    const videoUrl = (r.video_url ?? "").trim() || null;
    const isVideo = Boolean(r.is_video) || Boolean(videoUrl);
    cleaned.push({
      url,
      label: (r.label ?? "").trim(),
      zoomUrl: (r.zoom_url ?? "").trim() || null,
      videoUrl,
      poster: (r.poster ?? "").trim() || null,
      isVideo,
      position: typeof r.position === "number" ? r.position : 0,
    });
  }
  cleaned.sort((a, b) => a.position - b.position);
  return cleaned;
}
