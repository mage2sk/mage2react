/**
 * Client-side compare-list store.
 *
 * Owns three atoms (`compareIds`, `compareUid`, `compareLoading`) plus a
 * small local `compareErrorToast` so we don't reach into `cart-store.ts`.
 * The server-side list UID is kept in sync with the `m2r_compare_uid`
 * cookie on every mutation.
 *
 * Capacity is capped at 4 — matching Luma's default — to keep the compare
 * table readable on a 1280px viewport.
 */

import { atom } from "nanostores";
import {
  addProductsToCompareList,
  COMPARE_COOKIE_MAX_AGE,
  COMPARE_COOKIE_NAME,
  COMPARE_MAX_ITEMS,
  createCompareList,
  deleteCompareList,
  getCompareList,
  removeProductsFromCompareList,
} from "./queries-compare";

/* -------------------------------------------------------------------------- */
/* Atoms                                                                      */
/* -------------------------------------------------------------------------- */

export const compareIds = atom<string[]>([]);
export const compareUid = atom<string | null>(null);
export const compareLoading = atom<boolean>(false);
export const compareErrorToast = atom<string | null>(null);

/* -------------------------------------------------------------------------- */
/* Cross-tab sync                                                             */
/* -------------------------------------------------------------------------- */

type BroadcastMsg =
  | { type: "compare-updated"; ids: string[]; uid: string | null }
  | { type: "compare-cleared" };

let broadcastChannel: BroadcastChannel | null = null;
const BC_NAME = "m2r-compare";

function publish(msg: BroadcastMsg): void {
  if (broadcastChannel) {
    try { broadcastChannel.postMessage(msg); } catch { /* noop */ }
    return;
  }
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(
        "m2r-compare-sync",
        JSON.stringify({ at: Date.now(), msg }),
      );
    } catch { /* noop */ }
  }
}

function handleIncoming(msg: BroadcastMsg): void {
  if (msg.type === "compare-updated") {
    compareIds.set(msg.ids);
    compareUid.set(msg.uid);
  } else if (msg.type === "compare-cleared") {
    compareIds.set([]);
    compareUid.set(null);
  }
}

/* -------------------------------------------------------------------------- */
/* Cookie helpers (client)                                                    */
/* -------------------------------------------------------------------------- */

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${COMPARE_COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ];
  if (typeof location !== "undefined" && location.protocol === "https:") {
    attrs.push("Secure");
  }
  document.cookie = attrs.join("; ");
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/* -------------------------------------------------------------------------- */
/* Toast                                                                      */
/* -------------------------------------------------------------------------- */

function flashError(message: string): void {
  compareErrorToast.set(message);
  setTimeout(() => {
    if (compareErrorToast.get() === message) compareErrorToast.set(null);
  }, 4000);
}

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                  */
/* -------------------------------------------------------------------------- */

let bootstrapped = false;

export function bootstrapCompare(): void {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;

  if (typeof BroadcastChannel !== "undefined") {
    try {
      broadcastChannel = new BroadcastChannel(BC_NAME);
      broadcastChannel.onmessage = (e: MessageEvent<BroadcastMsg>) => {
        if (e?.data) handleIncoming(e.data);
      };
    } catch { /* sandboxed iframes */ }
  }
  if (!broadcastChannel) {
    window.addEventListener("storage", (e) => {
      if (e.key !== "m2r-compare-sync" || !e.newValue) return;
      try {
        const payload = JSON.parse(e.newValue) as { msg: BroadcastMsg };
        handleIncoming(payload.msg);
      } catch { /* ignore bad payloads */ }
    });
  }

  const uid = readCookie(COMPARE_COOKIE_NAME);
  if (!uid) return;
  compareUid.set(uid);
  void (async () => {
    try {
      const list = await getCompareList(uid);
      if (!list) {
        // Server forgot this list — clear our cookie so the next add
        // creates a fresh one rather than failing forever.
        clearCookie(COMPARE_COOKIE_NAME);
        compareUid.set(null);
        return;
      }
      const ids = (list.items ?? [])
        .filter((it): it is NonNullable<typeof it> => it != null)
        .map((it) => it.product.uid);
      compareIds.set(ids);
    } catch {
      // Leave the uid in place — a subsequent mutation will surface the error.
    }
  })();
}

async function ensureCompareUid(): Promise<string | null> {
  const existing = compareUid.get();
  if (existing) return existing;
  try {
    const uid = await createCompareList([]);
    if (!uid) return null;
    compareUid.set(uid);
    writeCookie(COMPARE_COOKIE_NAME, uid);
    return uid;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export async function addToCompare(productUid: string): Promise<boolean> {
  const current = compareIds.get();
  if (current.includes(productUid)) return true; // idempotent
  if (current.length >= COMPARE_MAX_ITEMS) {
    flashError("Compare list full — remove one to add another");
    return false;
  }

  compareLoading.set(true);
  // Optimistic insert.
  compareIds.set([...current, productUid]);
  try {
    const uid = await ensureCompareUid();
    if (!uid) {
      compareIds.set(current);
      flashError("Couldn't reach server, try again");
      return false;
    }
    const list = await addProductsToCompareList(uid, [productUid]);
    if (!list) {
      compareIds.set(current);
      flashError("Couldn't add to compare, try again");
      return false;
    }
    const ids = (list.items ?? [])
      .filter((it): it is NonNullable<typeof it> => it != null)
      .map((it) => it.product.uid);
    compareIds.set(ids);
    publish({ type: "compare-updated", ids, uid });
    return true;
  } catch {
    compareIds.set(current);
    flashError("Couldn't reach server, try again");
    return false;
  } finally {
    compareLoading.set(false);
  }
}

export async function removeFromCompare(productUid: string): Promise<boolean> {
  const current = compareIds.get();
  if (!current.includes(productUid)) return true;

  compareLoading.set(true);
  compareIds.set(current.filter((id) => id !== productUid));
  try {
    const uid = compareUid.get();
    if (!uid) return true; // nothing server-side to remove
    const list = await removeProductsFromCompareList(uid, [productUid]);
    if (!list) {
      compareIds.set(current);
      flashError("Couldn't remove from compare, try again");
      return false;
    }
    const ids = (list.items ?? [])
      .filter((it): it is NonNullable<typeof it> => it != null)
      .map((it) => it.product.uid);
    compareIds.set(ids);
    publish({ type: "compare-updated", ids, uid });
    return true;
  } catch {
    compareIds.set(current);
    flashError("Couldn't reach server, try again");
    return false;
  } finally {
    compareLoading.set(false);
  }
}

export async function clearCompare(): Promise<boolean> {
  const uid = compareUid.get();
  compareLoading.set(true);
  try {
    if (uid) {
      await deleteCompareList(uid);
    }
    compareIds.set([]);
    compareUid.set(null);
    clearCookie(COMPARE_COOKIE_NAME);
    publish({ type: "compare-cleared" });
    return true;
  } catch {
    flashError("Couldn't clear compare, try again");
    return false;
  } finally {
    compareLoading.set(false);
  }
}

/* -------------------------------------------------------------------------- */
/* Auto-bootstrap in the browser                                              */
/* -------------------------------------------------------------------------- */

if (typeof window !== "undefined") {
  queueMicrotask(bootstrapCompare);
}
