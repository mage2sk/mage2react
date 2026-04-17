import { atom } from "nanostores";
import {
  addProductsToCart,
  applyCouponToCart as applyCouponMutation,
  CART_COOKIE_NAME,
  getCart,
  getOrCreateCartId,
  removeCouponFromCart as removeCouponMutation,
  removeItemFromCart,
  updateCartItems,
  type AddProductInput,
  type CartItemT,
  type CartT,
} from "./queries-cart";

export type { CartT, CartItemT } from "./queries-cart";

/* -------------------------------------------------------------------------- */
/* Core atoms                                                                  */
/* -------------------------------------------------------------------------- */

export const cart = atom<CartT | null>(null);
export const cartId = atom<string | null>(null);
export const isCartOpen = atom(false);
export const loading = atom(false);
export const errorToast = atom<string | null>(null);

let bootstrapped = false;
let broadcastChannel: BroadcastChannel | null = null;
const BC_NAME = "m2r-cart";

/* -------------------------------------------------------------------------- */
/* Derived helpers                                                             */
/* -------------------------------------------------------------------------- */

export function cartCount(c: CartT | null): number {
  return c?.total_quantity ?? 0;
}

export function cartSubtotal(
  c: CartT | null,
): { value: number; currency: string } | null {
  const s =
    c?.prices?.subtotal_including_tax?.value != null
      ? c.prices.subtotal_including_tax
      : c?.prices?.subtotal_excluding_tax;
  if (!s || s.value == null || !s.currency) return null;
  return { value: s.value, currency: s.currency };
}

export function cartGrandTotal(
  c: CartT | null,
): { value: number; currency: string } | null {
  const g = c?.prices?.grand_total;
  if (!g || g.value == null || !g.currency) return null;
  return { value: g.value, currency: g.currency };
}

export function nonNullItems(c: CartT | null): CartItemT[] {
  return (c?.items ?? []).filter((i): i is CartItemT => i != null);
}

/* -------------------------------------------------------------------------- */
/* Cookie read (client)                                                        */
/* -------------------------------------------------------------------------- */

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/* -------------------------------------------------------------------------- */
/* Cross-tab sync                                                              */
/* -------------------------------------------------------------------------- */

type BroadcastMsg =
  | { type: "cart-updated"; cart: CartT | null }
  | { type: "cart-id-set"; id: string };

function publish(msg: BroadcastMsg): void {
  if (broadcastChannel) {
    try { broadcastChannel.postMessage(msg); } catch { /* noop */ }
    return;
  }
  // Fallback to storage event. We bump a key with a timestamp so multiple
  // writes fire even with identical payload.
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(
        "m2r-cart-sync",
        JSON.stringify({ at: Date.now(), msg }),
      );
    } catch { /* noop */ }
  }
}

function handleIncoming(msg: BroadcastMsg): void {
  if (msg.type === "cart-updated") {
    cart.set(msg.cart);
  } else if (msg.type === "cart-id-set") {
    cartId.set(msg.id);
  }
}

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Hydrate `cartId` + `cart` from the current `m2r_cart_id` cookie. Safe to
 * call many times; only the first invocation actually hits the network.
 */
export function bootstrapCart(): void {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;

  // Cross-tab channel.
  if (typeof BroadcastChannel !== "undefined") {
    try {
      broadcastChannel = new BroadcastChannel(BC_NAME);
      broadcastChannel.onmessage = (e: MessageEvent<BroadcastMsg>) => {
        if (e?.data) handleIncoming(e.data);
      };
    } catch { /* some sandboxed iframes */ }
  }
  if (!broadcastChannel && typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== "m2r-cart-sync" || !e.newValue) return;
      try {
        const payload = JSON.parse(e.newValue) as { msg: BroadcastMsg };
        handleIncoming(payload.msg);
      } catch { /* ignore bad payloads */ }
    });
  }

  // Refetch the cart on every Astro view-transition AND on full page loads
  // (covers form-submit redirects, session changes, etc.). Initial fetch is
  // fired immediately below. Goes through `/api/cart/current` so the server
  // can pick `customerCart` vs `cart(cart_id)` based on the HttpOnly auth
  // cookie — the browser can't see that cookie, so it must not try to pick
  // the GraphQL field itself (doing so produces a 403 when the cart cookie
  // and the session customer don't agree).
  const listen = (): void => {
    void (async () => {
      try {
        const res = await fetch("/api/cart/current", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { cart: CartT | null };
        const c = body.cart;
        cart.set(c);
        const syncedId = readCookie(CART_COOKIE_NAME);
        if (cartId.get() !== syncedId) cartId.set(syncedId ?? null);
      } catch {
        // network error; keep previous state.
      }
    })();
  };

  window.addEventListener("astro:page-load", listen);
  window.addEventListener("pageshow", listen);
  listen();
}

/** Force a fresh cart refetch. Call after any server-side mutation that
 *  changed the cart but didn't go through our store (e.g. reorder). */
export function refetchCart(): void {
  void (async () => {
    try {
      const res = await fetch("/api/cart/current", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const body = (await res.json()) as { cart: CartT | null };
      const c = body.cart;
      cart.set(c);
      const syncedId = readCookie(CART_COOKIE_NAME);
      if (cartId.get() !== syncedId) cartId.set(syncedId ?? null);
      publish({ type: "cart-updated", cart: c });
    } catch { /* swallow */ }
  })();
}

async function ensureCartId(): Promise<string> {
  const existing = cartId.get();
  if (existing) return existing;
  const id = await getOrCreateCartId();
  cartId.set(id);
  publish({ type: "cart-id-set", id });
  return id;
}

function flashError(message: string): void {
  errorToast.set(message);
  setTimeout(() => {
    if (errorToast.get() === message) errorToast.set(null);
  }, 4000);
  // Also route into the global toaster so the user sees it even if a
  // local component hasn't rendered the inline error yet.
  void import("./toast-store").then((m) => m.toast.error(message)).catch(() => {});
}

export function flashSuccess(message: string): void {
  void import("./toast-store").then((m) => m.toast.success(message)).catch(() => {});
}

/* -------------------------------------------------------------------------- */
/* Mutations — optimistic where cheap, reconcile with server response         */
/* -------------------------------------------------------------------------- */

export type AddOptions = {
  sku: string;
  quantity?: number;
  parentSku?: string;
  selectedOptionUids?: string[];
};

function isStaleCartError(e: { code?: string | null; message?: string | null } | undefined): boolean {
  if (!e) return false;
  const m = (e.message ?? "").toLowerCase();
  return (
    e.code === "NO_SUCH_ENTITY" ||
    e.code === "graphql-authorization" ||
    m.includes("could not find a cart") ||
    m.includes("cart isn't active") ||
    m.includes("current user cannot") ||
    m.includes("cannot perform operations") ||
    m.includes("not allowed to access this cart")
  );
}

async function forceNewCart(): Promise<string> {
  const id = await getOrCreateCartId();
  cartId.set(id);
  publish({ type: "cart-id-set", id });
  return id;
}

export async function addItem(input: AddOptions): Promise<boolean> {
  loading.set(true);
  const payload: AddProductInput = {
    sku: input.sku,
    quantity: input.quantity ?? 1,
  };
  if (input.parentSku) payload.parent_sku = input.parentSku;
  if (input.selectedOptionUids && input.selectedOptionUids.length > 0) {
    payload.selected_options = input.selectedOptionUids;
  }

  const attempt = async (id: string): Promise<{ ok: boolean; stale: boolean; message?: string }> => {
    try {
      const { cart: next, userErrors } = await addProductsToCart(id, [payload]);
      if (userErrors.length > 0) {
        const first = userErrors[0];
        if (isStaleCartError(first)) return { ok: false, stale: true, message: first?.message ?? "" };
        return { ok: false, stale: false, message: first?.message ?? "Couldn't add to cart" };
      }
      cart.set(next);
      publish({ type: "cart-updated", cart: next });
      isCartOpen.set(true);
      flashSuccess("Added to cart");
      return { ok: true, stale: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const lower = msg.toLowerCase();
      if (
        lower.includes("could not find a cart") ||
        lower.includes("cannot perform operations") ||
        lower.includes("not allowed to access this cart") ||
        lower.includes("graphql-authorization")
      ) {
        return { ok: false, stale: true, message: msg };
      }
      throw err;
    }
  };

  try {
    const id = await ensureCartId();
    let r = await attempt(id);
    if (!r.ok && r.stale) {
      try {
        if (typeof document !== "undefined") {
          document.cookie = "m2r_cart_id=; Path=/; Max-Age=0; SameSite=Lax; Secure";
        }
        cartId.set(null);
        const freshId = await forceNewCart();
        r = await attempt(freshId);
      } catch (retryErr) {
        console.error("[m2r:cart] retry after stale failed", retryErr);
        flashError("Couldn't add to cart. Please try again.");
        return false;
      }
    }
    if (!r.ok) {
      flashError(r.message || "Couldn't add to cart");
    }
    return r.ok;
  } catch (err) {
    console.error("[m2r:cart] addItem failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    // Zod validation errors start with "[" (the JSON issues array).
    if (msg.includes("could not find a cart") || msg.toLowerCase().includes("no such entity")) {
      // One more retry with a fresh cart — defensive.
      try {
        if (typeof document !== "undefined") {
          document.cookie = "m2r_cart_id=; Path=/; Max-Age=0; SameSite=Lax; Secure";
        }
        cartId.set(null);
        const freshId = await forceNewCart();
        const r = await attempt(freshId);
        if (!r.ok) flashError(r.message || "Couldn't add to cart");
        return r.ok;
      } catch (e2) {
        console.error("[m2r:cart] final retry failed", e2);
      }
    }
    flashError("Couldn't add to cart. Please try again.");
    return false;
  } finally {
    loading.set(false);
  }
}

export async function removeItem(cartItemUid: string): Promise<void> {
  const prior = cart.get();
  // Optimistic: drop the line locally.
  if (prior?.items) {
    const next: CartT = {
      ...prior,
      items: prior.items.filter((i) => i?.uid !== cartItemUid),
      total_quantity: Math.max(
        0,
        prior.total_quantity -
          (prior.items.find((i) => i?.uid === cartItemUid)?.quantity ?? 0),
      ),
    };
    cart.set(next);
  }
  loading.set(true);
  try {
    const id = await ensureCartId();
    const { cart: fresh, userErrors } = await removeItemFromCart(id, cartItemUid);
    if (userErrors.length > 0) {
      flashError(userErrors[0]?.message ?? "Couldn't remove item");
      cart.set(prior); // revert
      return;
    }
    cart.set(fresh);
    publish({ type: "cart-updated", cart: fresh });
  } catch {
    cart.set(prior); // revert
    flashError("Couldn't reach server, try again");
  } finally {
    loading.set(false);
  }
}

export async function setQty(cartItemUid: string, qty: number): Promise<void> {
  const safeQty = Math.max(0, Math.min(999, Math.floor(qty)));
  const prior = cart.get();
  // Optimistic: update qty locally.
  if (prior?.items) {
    const next: CartT = {
      ...prior,
      items: prior.items.map((i) =>
        i && i.uid === cartItemUid ? { ...i, quantity: safeQty } : i,
      ),
    };
    cart.set(next);
  }
  loading.set(true);
  try {
    const id = await ensureCartId();
    const { cart: fresh, userErrors } = await updateCartItems(id, [
      { cart_item_uid: cartItemUid, quantity: safeQty },
    ]);
    if (userErrors.length > 0) {
      flashError(userErrors[0]?.message ?? "Couldn't update quantity");
      cart.set(prior);
      return;
    }
    cart.set(fresh);
    publish({ type: "cart-updated", cart: fresh });
  } catch {
    cart.set(prior);
    flashError("Couldn't reach server, try again");
  } finally {
    loading.set(false);
  }
}

export async function applyCoupon(code: string): Promise<boolean> {
  loading.set(true);
  try {
    const id = await ensureCartId();
    const { cart: fresh, userErrors } = await applyCouponMutation(id, code);
    if (userErrors.length > 0) {
      flashError(userErrors[0]?.message ?? "Invalid coupon");
      return false;
    }
    cart.set(fresh);
    publish({ type: "cart-updated", cart: fresh });
    return true;
  } catch {
    flashError("Couldn't reach server, try again");
    return false;
  } finally {
    loading.set(false);
  }
}

export async function removeCoupon(): Promise<void> {
  loading.set(true);
  try {
    const id = await ensureCartId();
    const { cart: fresh } = await removeCouponMutation(id);
    cart.set(fresh);
    publish({ type: "cart-updated", cart: fresh });
  } catch {
    flashError("Couldn't reach server, try again");
  } finally {
    loading.set(false);
  }
}

/**
 * Refetch the cart from Magento. Useful for pages that mount after a
 * mutation elsewhere, or for reconciling after a failed optimistic update.
 */
export async function refreshCart(): Promise<void> {
  const id = cartId.get() ?? readCookie(CART_COOKIE_NAME);
  if (!id) return;
  try {
    const fresh = await getCart(id);
    cart.set(fresh);
    publish({ type: "cart-updated", cart: fresh });
  } catch { /* swallow; UI keeps prior state */ }
}

/* -------------------------------------------------------------------------- */
/* Auto-bootstrap in the browser                                              */
/* -------------------------------------------------------------------------- */

if (typeof window !== "undefined") {
  // Run after the current tick so atoms are fully initialised before we
  // start firing network requests.
  queueMicrotask(bootstrapCart);
}
