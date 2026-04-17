import { getCmsBlocks } from "./queries";

/**
 * Magento CMS content can contain several template directives that only make
 * sense on the Magento frontend — they're rendered server-side by Magento's
 * block / widget system. Since we render CMS HTML ourselves, we need to
 * expand them before handing the content to DOMPurify + set:html.
 *
 * Supported directives (best-effort):
 *
 *   {{block id="identifier"}}
 *   {{widget type="Magento\Cms\Block\Widget\Block" template="widget/static_block/default.phtml" block_id="N"}}
 *   {{widget type="Magento\Cms\Block\Widget\Block" block_id="identifier"}}
 *   {{media url="path/to/file.jpg"}}
 *   {{store url="path"}}
 *   {{config path="web/unsecure/base_url"}}
 *
 * For directives we can't resolve we strip them silently rather than leak
 * the raw `{{...}}` text to users. Extend as needed for custom widgets.
 */

const MEDIA_URL = import.meta.env.PUBLIC_MEDIA_URL ?? "https://mage2react.local/media";
const SITE_URL = import.meta.env.PUBLIC_SITE_URL ?? "https://mage2react.local";

type DirectiveAttrs = Record<string, string>;

function parseAttrs(inner: string): DirectiveAttrs {
  const out: DirectiveAttrs = {};
  const re = /(\w+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    if (m[1]) out[m[1]] = m[2] ?? "";
  }
  return out;
}

async function renderBlockWidget(attrs: DirectiveAttrs): Promise<string> {
  // block id= or block_id=
  const id =
    attrs["block_id"] ?? attrs["block_identifier"] ?? attrs["id"] ?? null;
  if (!id) return "";
  try {
    const blocks = await getCmsBlocks([id]);
    const block = blocks[id];
    if (!block?.content) return "";
    // Recurse — a block may itself contain widgets.
    return await resolveCmsDirectives(block.content);
  } catch {
    return "";
  }
}

function renderMediaDirective(attrs: DirectiveAttrs): string {
  const u = attrs["url"];
  if (!u) return "";
  const base = MEDIA_URL.replace(/\/+$/, "");
  const path = u.replace(/^\/+/, "");
  return `${base}/${path}`;
}

function renderStoreDirective(attrs: DirectiveAttrs): string {
  const u = attrs["url"] ?? attrs["direct_url"] ?? "";
  const base = SITE_URL.replace(/\/+$/, "");
  const path = u.replace(/^\/+/, "");
  return path ? `${base}/${path}` : base;
}

/**
 * Expand Magento directives inside the given HTML string. Safe to call on
 * HTML that has no directives (no-op). Never throws — returns the input
 * unchanged on any internal error.
 */
export async function resolveCmsDirectives(html: string | null | undefined): Promise<string> {
  if (!html) return "";
  let out = html;

  try {
    // 1. {{block id="foo"}}
    out = await replaceAsync(out, /\{\{\s*block\s+([^}]+)\}\}/g, async (_, inner) => {
      const attrs = parseAttrs(String(inner));
      return renderBlockWidget(attrs);
    });

    // 2. {{widget type="..." ...}} — we recognise the static-block widget.
    out = await replaceAsync(out, /\{\{\s*widget\s+([^}]+)\}\}/g, async (_, inner) => {
      const attrs = parseAttrs(String(inner));
      const type = (attrs["type"] ?? "").toLowerCase();
      if (type.includes("cms") && type.includes("block")) {
        return renderBlockWidget(attrs);
      }
      // Unknown widget — drop silently (we'd rather show nothing than
      // leak the raw `{{widget ...}}` text).
      return "";
    });

    // 3. {{media url="..."}} — typically embedded in src= or href=. Handle
    //    inside attribute values too (double-quoted and single-quoted).
    out = out.replace(/\{\{\s*media\s+([^}]+)\}\}/g, (_, inner) => {
      return renderMediaDirective(parseAttrs(String(inner)));
    });

    // 4. {{store url="..."}} or {{store direct_url="..."}}
    out = out.replace(/\{\{\s*store\s+([^}]+)\}\}/g, (_, inner) => {
      return renderStoreDirective(parseAttrs(String(inner)));
    });

    // 5. {{config path="..."}} — rare, safe to strip (config values are
    //    server-side and shouldn't leak).
    out = out.replace(/\{\{\s*config\s+[^}]+\}\}/g, "");

    return out;
  } catch {
    return html;
  }
}

/**
 * Helper: String.replaceAll with async replacer. Runs all replacements in
 * parallel for speed, substitutes in one pass.
 */
async function replaceAsync(
  input: string,
  re: RegExp,
  replacer: (match: string, ...groups: string[]) => Promise<string>,
): Promise<string> {
  const tasks: Array<Promise<string>> = [];
  input.replace(re, (match, ...rest) => {
    const groups = rest.slice(0, rest.length - 2) as string[];
    tasks.push(replacer(match, ...groups));
    return match;
  });
  const results = await Promise.all(tasks);
  let i = 0;
  return input.replace(re, () => results[i++] ?? "");
}
