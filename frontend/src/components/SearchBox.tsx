/**
 * <SearchBox/> — debounced autocomplete-style search input.
 *
 * Not wired into the layout yet — intentionally. A header-polish agent will
 * import this into Base.astro later:
 *
 *   import SearchBox from "~/components/SearchBox.tsx";
 *   <SearchBox client:idle />
 *
 * Behaviour:
 *   - 250ms debounce after each keystroke.
 *   - Fetches a tiny GraphQL payload (top 5 matches) through the already-wired
 *     Magento proxy on the origin (no CORS, no server-side helper needed).
 *   - Keyboard nav: ↑ / ↓ cycles suggestions, Enter opens the focused row.
 *   - Escape closes the dropdown; Esc a second time clears the input.
 *   - Submitting (full Enter with no focused row) navigates to /search?q=…
 *   - Renders absolutely-positioned suggestions; callers are responsible for
 *     positioning the parent container (relative).
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export interface SearchBoxProps {
  /** URL to submit to when user presses Enter without picking a suggestion. */
  action?: string;
  /** Optional input name; the URL uses `?q=…` so keep this stable. */
  inputName?: string;
  /** Placeholder copy. */
  placeholder?: string;
  /** Auto-focus the input on mount (e.g. for a modal). */
  autoFocus?: boolean;
  /** Max suggestion rows. Default 5. */
  maxResults?: number;
}

interface Suggestion {
  uid: string;
  name: string;
  sku: string;
  url_key: string | null;
  url_suffix: string | null;
  image: string | null;
  price: number | null;
  currency: string | null;
}

const GRAPHQL_ENDPOINT = "/graphql";

const SEARCH_DOC = /* GraphQL */ `
  query SearchAutocomplete($term: String!, $pageSize: Int!) {
    products(search: $term, pageSize: $pageSize, currentPage: 1) {
      items {
        uid
        name
        sku
        url_key
        url_suffix
        small_image { url }
        price_range {
          minimum_price { final_price { value currency } }
        }
      }
    }
  }
`;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

async function fetchSuggestions(term: string, pageSize: number, signal: AbortSignal): Promise<Suggestion[]> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Store: "default" },
    body: JSON.stringify({ query: SEARCH_DOC, variables: { term, pageSize } }),
    signal,
  });
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    data?: {
      products?: {
        items?: Array<{
          uid: string;
          name: string;
          sku: string;
          url_key: string | null;
          url_suffix: string | null;
          small_image: { url: string | null } | null;
          price_range: {
            minimum_price: {
              final_price: { value: number | null; currency: string | null };
            };
          };
        }>;
      };
    };
  };
  const items = payload.data?.products?.items ?? [];
  return items.map((p) => ({
    uid: p.uid,
    name: p.name,
    sku: p.sku,
    url_key: p.url_key,
    url_suffix: p.url_suffix ?? ".html",
    image: p.small_image?.url ?? null,
    price: p.price_range.minimum_price.final_price.value,
    currency: p.price_range.minimum_price.final_price.currency,
  }));
}

function formatMoney(value: number | null, currency: string | null): string {
  if (value == null) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency ?? ""} ${value.toFixed(2)}`.trim();
  }
}

export default function SearchBox({
  action = "/search",
  inputName = "q",
  placeholder = "Search the store",
  autoFocus = false,
  maxResults = 5,
}: SearchBoxProps) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounced = useDebouncedValue(term, 250);
  const listId = `sb-list-${useId()}`;

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetchSuggestions(q, maxResults, ctrl.signal)
      .then((rows) => {
        setSuggestions(rows);
        setActive(-1);
        setOpen(true);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name !== "AbortError") {
          setSuggestions([]);
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [debounced, maxResults]);

  const hrefFor = useCallback((s: Suggestion) => {
    if (!s.url_key) return action;
    return `/${s.url_key}${s.url_suffix ?? ".html"}`;
  }, [action]);

  const submitTerm = useCallback(() => {
    const q = term.trim();
    if (!q) return;
    window.location.assign(`${action}?q=${encodeURIComponent(q)}`);
  }, [action, term]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        submitTerm();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => (i + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        break;
      case "Enter": {
        e.preventDefault();
        const chosen = suggestions[active];
        if (chosen) window.location.assign(hrefFor(chosen));
        else submitTerm();
        break;
      }
      case "Escape":
        if (open) setOpen(false);
        else setTerm("");
        break;
    }
  };

  return (
    <div className="relative w-full">
      <form
        action={action}
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          submitTerm();
        }}
        role="search"
      >
        <input
          ref={inputRef}
          type="search"
          name={inputName}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            // Delay so click on suggestion registers before close.
            window.setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={active >= 0 && suggestions[active] ? `${listId}-${suggestions[active].uid}` : undefined}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
        />
      </form>

      {open && term.trim().length >= 2 && (suggestions.length > 0 || loading) && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg"
        >
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500">Searching…</li>
          )}
          {suggestions.map((s, i) => (
            <li key={s.uid} id={`${listId}-${s.uid}`} role="option" aria-selected={i === active}>
              <a
                href={hrefFor(s)}
                className={
                  "flex items-center gap-3 px-3 py-2 text-sm " +
                  (i === active ? "bg-zinc-100" : "hover:bg-zinc-50")
                }
                onMouseEnter={() => setActive(i)}
              >
                {s.image ? (
                  <img
                    src={s.image}
                    alt=""
                    width="40"
                    height="40"
                    loading="lazy"
                    decoding="async"
                    className="h-10 w-10 shrink-0 rounded bg-zinc-100 object-cover"
                  />
                ) : (
                  <span aria-hidden="true" className="inline-block h-10 w-10 shrink-0 rounded bg-zinc-100" />
                )}
                <span className="flex-1 truncate">{s.name}</span>
                {s.price != null && (
                  <span className="shrink-0 text-xs font-semibold text-zinc-900">
                    {formatMoney(s.price, s.currency)}
                  </span>
                )}
              </a>
            </li>
          ))}
          {!loading && suggestions.length >= maxResults && (
            <li>
              <a
                href={`${action}?q=${encodeURIComponent(term.trim())}`}
                className="block border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-center text-xs font-semibold text-[var(--color-brand)] hover:bg-zinc-100"
              >
                See all results →
              </a>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
