# Panth_SearchAutocompleteReact

React/Astro storefront companion for `Panth_SearchAutocomplete` (`mage2kishan/module-search-autocomplete`). Replaces the header `SearchBox` dropdown with grouped suggestions: Products / Categories / Popular Searches, each with thumbnails, price and popularity hints.

## Storefront integration

- `frontend/src/lib/queries-search-autocomplete.ts` — `searchAutocomplete(query, pageSize)` returning `{ suggestions: [{ type, label, url, thumbnail, price, popularity }], total_count }`. Falls back to a stock `products(search:...)` query when the parent module isn't installed.
- `frontend/src/components/panth/search-autocomplete/PanthSearchBox.tsx` — React island, `client:idle`. Debounced at 200 ms, keyboard-navigable (↑ / ↓ / Enter / Esc), suggestion groups with sticky headings. Uses `useId` for list/option ids.

## How to wire into Base.astro

Do NOT edit `Base.astro` from this module. The storefront maintainer should swap the existing import when `Panth_SearchAutocomplete` is enabled:

```astro
---
// Replace:
//   import SearchBox from "~/components/SearchBox.tsx";
//   <SearchBox client:idle />
import PanthSearchBox from "~/components/panth/search-autocomplete/PanthSearchBox.tsx";
---
<PanthSearchBox client:idle />
```

The component still submits `?q=<term>` to `/search` (same contract as `SearchBox`), so the results page needs no changes.
