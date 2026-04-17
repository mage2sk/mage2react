import { useEffect, useRef, useState } from "react";

type MeResponse =
  | { signedIn: true; firstname?: string | null; email?: string | null }
  | { signedIn: false };

export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancel = false;
    fetch("/api/customer/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((j: MeResponse) => {
        if (!cancel) setMe(j);
      })
      .catch(() => {
        if (!cancel) setMe({ signedIn: false });
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent): void => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (!btnRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", onDocClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signedIn = me?.signedIn === true;
  const name =
    me && "firstname" in me && me.firstname ? me.firstname : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={signedIn ? "My account menu" : "Sign in"}
        aria-expanded={open}
        aria-haspopup="menu"
        className="grid size-10 place-items-center rounded-md text-zinc-700 hover:bg-zinc-100 hover:text-[var(--color-brand)]"
      >
        <svg
          className="size-5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
        >
          {signedIn ? (
            <>
              <div className="border-b border-zinc-100 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Signed in{name ? ` as` : ""}
                </p>
                {name && (
                  <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900">
                    {name}
                  </p>
                )}
              </div>
              <MenuLink href="/customer/account">My Account</MenuLink>
              <MenuLink href="/sales/order/history">My Orders</MenuLink>
              <MenuLink href="/customer/address">Address Book</MenuLink>
              <MenuLink href="/wishlist">My Wishlist</MenuLink>
              <MenuLink href="/customer/account/edit">Account Information</MenuLink>
              <div className="my-1 border-t border-zinc-100" />
              <MenuLink href="/customer/account/logout" variant="danger">
                Sign Out
              </MenuLink>
            </>
          ) : (
            <>
              <div className="border-b border-zinc-100 px-4 py-3">
                <p className="text-sm font-semibold text-zinc-900">Welcome</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Sign in to track orders and save items
                </p>
              </div>
              <MenuLink href="/customer/account/login">Sign In</MenuLink>
              <MenuLink href="/customer/account/create">Create an Account</MenuLink>
              <div className="my-1 border-t border-zinc-100" />
              <MenuLink href="/wishlist">My Wishlist</MenuLink>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
  variant,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "danger";
}) {
  return (
    <a
      href={href}
      role="menuitem"
      className={`block px-4 py-2 text-sm ${
        variant === "danger"
          ? "text-red-600 hover:bg-red-50"
          : "text-zinc-700 hover:bg-zinc-50 hover:text-[var(--color-brand)]"
      }`}
    >
      {children}
    </a>
  );
}
