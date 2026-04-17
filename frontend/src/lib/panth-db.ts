/**
 * panth-db.ts — direct MySQL read-only pool for Panth_* storefront widgets.
 *
 * The installed Panth_* Magento extensions do not expose GraphQL or REST
 * endpoints for their admin-managed content (banner slider, FAQ, WhatsApp,
 * notification bar, testimonials). To render them on the Astro storefront
 * we read the seeded `panth_*` tables directly over the Docker network.
 *
 * Server-only: this file must never be imported from client components.
 * Astro only evaluates the frontmatter on the server, so importing from a
 * `.astro` file's frontmatter or a `*.server.ts` helper is safe.
 */
import mysql from "mysql2/promise";

type PanthRow = Record<string, unknown>;

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool | null {
  if (pool) return pool;
  const host = process.env.PANTH_DB_HOST;
  const user = process.env.PANTH_DB_USER;
  const password = process.env.PANTH_DB_PASSWORD;
  const database = process.env.PANTH_DB_NAME;
  const port = Number.parseInt(process.env.PANTH_DB_PORT ?? "3306", 10);
  if (!host || !user || !database) return null;
  pool = mysql.createPool({
    host,
    port: Number.isFinite(port) ? port : 3306,
    user,
    password: password ?? "",
    database,
    connectionLimit: 4,
    waitForConnections: true,
    enableKeepAlive: true,
    timezone: "Z",
    charset: "utf8mb4",
  });
  return pool;
}

export async function panthQuery<T = PanthRow>(
  sql: string,
  params: Array<string | number | null> = [],
): Promise<T[]> {
  const p = getPool();
  if (!p) return [];
  try {
    const [rows] = await p.execute(sql, params);
    return rows as T[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Table absent (module not installed) or column drift — swallow silently
    // but log once. Callers treat any empty array as "render nothing".
    if (/ER_NO_SUCH_TABLE|ER_BAD_FIELD_ERROR/.test(msg)) {
      console.warn(`[panth-db] schema miss: ${msg}`);
      return [];
    }
    console.warn(`[panth-db] query failed: ${msg}`);
    return [];
  }
}

export async function panthConfig(path: string): Promise<string | null> {
  const rows = await panthQuery<{ value: string | null }>(
    "SELECT value FROM core_config_data WHERE path = ? AND scope = 'default' ORDER BY config_id DESC LIMIT 1",
    [path],
  );
  const first = rows[0];
  if (!first) return null;
  const val = first.value;
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : null;
}
