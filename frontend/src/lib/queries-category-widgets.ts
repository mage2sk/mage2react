import { panthQuery } from "./panth-db";

/**
 * queries-category-widgets.ts
 *
 * Resolves Magento widget assignments for a category page so the Astro
 * renderer can reproduce Luma's CMS-block composition (e.g. "What's New"
 * shows a `content.top` block with promo images and a `sidebar.main`
 * block with per-gender category links).
 *
 * Magento stores this in two rows:
 *   - `widget_instance.widget_parameters` — JSON with `block_id`.
 *   - `widget_instance_page.entities` — comma-separated category ids the
 *     widget is bound to, filtered by `page_group = 'anchor_categories'`.
 *   - `widget_instance_page.block_reference` — the layout position
 *     (`content.top`, `sidebar.main`, `content`, ...).
 *
 * Only widgets of type `Magento\Cms\Block\Widget\Block` are considered;
 * other widget types (recent orders, new products by attribute, ...) are
 * ignored — those have their own renderers.
 *
 * Returns an empty list when the category has no widget assignments, or
 * when the DB is unreachable. Never throws.
 */

export interface CategoryWidget {
  position: string;
  blockIdentifier: string;
  title: string;
}

interface Row {
  widget_parameters: string;
  block_reference: string;
  title: string;
  entities: string;
  instance_type: string;
}

export async function getCategoryWidgetBlocks(
  categoryId: number | string,
): Promise<CategoryWidget[]> {
  const catIdStr = String(categoryId);
  if (!catIdStr) return [];

  const rows = await panthQuery<Row>(
    `SELECT wi.widget_parameters, wip.block_reference, wi.title, wip.entities, wi.instance_type
       FROM widget_instance_page wip
       JOIN widget_instance wi ON wi.instance_id = wip.instance_id
      WHERE wip.page_group = 'anchor_categories'
        AND wi.instance_type = 'Magento\\\\Cms\\\\Block\\\\Widget\\\\Block'
        AND FIND_IN_SET(?, REPLACE(wip.entities, ' ', ''))`,
    [catIdStr],
  );

  if (rows.length === 0) return [];

  const blockIds = new Set<number>();
  const parsed: Array<{ blockId: number; position: string; title: string }> = [];
  for (const r of rows) {
    try {
      const params = JSON.parse(r.widget_parameters) as { block_id?: string | number };
      const idRaw = params.block_id;
      const id = typeof idRaw === "number" ? idRaw : Number.parseInt(String(idRaw ?? "0"), 10);
      if (!Number.isFinite(id) || id <= 0) continue;
      blockIds.add(id);
      parsed.push({ blockId: id, position: r.block_reference, title: r.title });
    } catch {
      /* malformed JSON — skip this row */
    }
  }

  if (blockIds.size === 0) return [];

  const idList = Array.from(blockIds);
  const placeholders = idList.map(() => "?").join(",");
  const blockRows = await panthQuery<{ block_id: number; identifier: string }>(
    `SELECT block_id, identifier FROM cms_block WHERE block_id IN (${placeholders}) AND is_active = 1`,
    idList,
  );
  const identById = new Map<number, string>();
  for (const r of blockRows) identById.set(r.block_id, r.identifier);

  return parsed
    .map((p) => {
      const identifier = identById.get(p.blockId);
      if (!identifier) return null;
      return { position: p.position, blockIdentifier: identifier, title: p.title };
    })
    .filter((v): v is CategoryWidget => v !== null);
}
