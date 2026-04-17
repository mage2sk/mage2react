/**
 * PanthSearchBox.tsx — richer header search with grouped suggestions.
 *
 * INTEGRATION (comment-only; do not edit Base.astro here):
 *   import PanthSearchBox from
 *     "~/components/panth/search-autocomplete/PanthSearchBox";
 *   <PanthSearchBox client:idle />
 *
 * Replaces `src/components/SearchBox.tsx` with:
 *   - 200ms debounce
 *   - 3 suggestion groups: Products / Categories / Popular Searches
 *   - Keyboard nav: ↑ / ↓ / Enter / Esc (Esc once closes, twice clears)
 *   - Hydration-safe: `hasMounted` guards dynamic state; `useId` for ids.
 *
 * The submit contract is unchanged — Enter on an empty active state sends the
 * user to `/search?q=<term>` just like the old SearchBox.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from "react";
import {
  searchAutocomplete,
  type Suggestion,
  type SuggestionType,
} from "~/lib/queries-search-autocomplete";

export interface PanthSearchBoxProps {
  action?: string;
  inputName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  maxResults?: number;
}

const DEBOUNCE_MS = 200;

const GROUP_ORDER: SuggestionType[] = ["product", "category", "term"];
const GROUP_TITLES: Record<SuggestionType, string> = {
  product: "Products",
  category: "Categories",
  term: "Popular searches",
};

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

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

export default function PanthSearchBox({
  action = "/search",
  inputName = "q",
  placeholder = "Search the store",
  autoFocus = false,
  maxResults = 8,
}: PanthSearchBoxProps): ReactElement {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [flat, setFlat] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounced = useDebouncedValue(term, DEBOUNCE_MS);

  const uid = useId();
  const safeUid = uid.replace(/[:]/g, "");
  const listId = `psb-${safeUid}`;

  useEffect(() => setHasMounted(true), []);

  useEffect(() => {
    if (!autoFocus || !hasMounted) return;
    inputRef.current?.focus();
  }, [autoFocus, hasMounted]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setFlat([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    void searchAutocomplete(q, maxResults, ctrl.signal)
      .then((result) => {
        setFlat(result.suggestions);
        setActive(-1);
        setOpen(true);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name !== "AbortError") {
          setFlat([]);
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [debounced, maxResults]);

  // Group by type for rendering, preserve display order within groups.
  const grouped = useMemo(() => {
    const by: Record<SuggestionType, Suggestion[]> = {
      product: [],
      category: [],
      term: [],
    };
    for (const s of flat) by[s.type].push(s);
    return by;
  }, [flat]);

  const orderedFlat = useMemo(() => {
    const out: Suggestion[] = [];
    for (const t of GROUP_ORDER) out.push(...grouped[t]);
    return out;
  }, [grouped]);

  const submitTerm = useCallback((): void => {
    const q = term.trim();
    if (!q) return;
    window.location.assign(`${action}?q=${encodeURIComponent(q)}`);
  }, [action, term]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (!open || orderedFlat.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        submitTerm();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => (i + 1) % orderedFlat.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (i <= 0 ? orderedFlat.length - 1 : i - 1));
        break;
      case "Enter": {
        e.preventDefault();
        const chosen = orderedFlat[active];
        if (chosen) window.location.assign(chosen.url);
        else submitTerm();
        break;
      }
      case "Escape":
        if (open) setOpen(false);
        else setTerm("");
        break;
    }
  };

  const showDropdown =
    hasMounted && open && term.trim().length >= 2 && (orderedFlat.length > 0 || loading);

  // Compute option ids so aria-activedescendant points to the focused row.
  const optionId = (index: number): string => `${listId}-opt-${index}`;

  return (
    <div className="relative w-full">
      <form
        action={action}
        method="get"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitTerm();
        }}
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
            if (orderedFlat.length > 0) setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-activedescendant={
            active >= 0 && orderedFlat[active] ? optionId(active) : undefined
          }
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
        />
      </form>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[28rem] overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg"
        >
          {loading && orderedFlat.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-500">Searching…</div>
          )}
          {GROUP_ORDER.map((type) => {
            const group = grouped[type];
            if (group.length === 0) return null;
            return (
              <section key={type} className="border-b border-zinc-100 last:border-b-0">
                <h3 className="sticky top-0 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {GROUP_TITLES[type]}
                </h3>
                <ul>
                  {group.map((s) => {
                    const idxInFlat = orderedFlat.indexOf(s);
                    const isActive = idxInFlat === active;
                    return (
                      <li
                        key={`${type}-${s.url}-${s.label}`}
                        id={optionId(idxInFlat)}
                        role="option"
                        aria-selected={isActive}
                      >
                        <a
                          href={s.url}
                          onMouseEnter={() => setActive(idxInFlat)}
                          className={
                            "flex items-center gap-3 px-3 py-2 text-sm " +
                            (isActive ? "bg-zinc-100" : "hover:bg-zinc-50")
                          }
                        >
                          {s.thumbnail ? (
                            <img
                              src={s.thumbnail}
                              alt=""
                              width="40"
                              height="40"
                              loading="lazy"
                              decoding="async"
                              className="h-10 w-10 shrink-0 rounded bg-zinc-100 object-cover"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="grid h-10 w-10 shrink-0 place-items-center rounded bg-zinc-100 text-zinc-400"
                            >
                              {type === "category" ? (
                                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinejoin="round" />
                                </svg>
                              ) : type === "term" ? (
                                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="11" cy="11" r="8" />
                                  <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                                </svg>
                              ) : null}
                            </span>
                          )}
                          <span className="flex-1 truncate">{s.label}</span>
                          {s.price && s.price.value != null && (
                            <span className="shrink-0 text-xs font-semibold text-zinc-900">
                              {formatMoney(s.price.value, s.price.currency)}
                            </span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {!loading && orderedFlat.length > 0 && (
            <a
              href={`${action}?q=${encodeURIComponent(term.trim())}`}
              className="block border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-center text-xs font-semibold text-[var(--color-brand)] hover:bg-zinc-100"
            >
              See all results →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
