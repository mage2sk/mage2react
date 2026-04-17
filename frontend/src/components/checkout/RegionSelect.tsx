import { useMemo, useState } from "react";

/**
 * Dependent country → region picker. When the user changes country the
 * region list rebuilds from the preloaded `countries` data. Countries
 * without predefined regions switch to a free-text input — Magento will
 * accept `{ region: "Free text" }` for those.
 *
 * Name convention (kept compatible with `AddressForm.astro`):
 *   - `country_code` — ISO-2 country code
 *   - `region_id`    — numeric Magento region id (when the country has regions)
 *   - `region`       — free-text region name (fallback)
 *
 * Form posts pick whichever of region_id or region is populated.
 */

type Region = { id: number | null; code: string | null; name: string | null };
type Country = {
  id: string | null;
  full_name_english: string | null;
  available_regions?: Region[] | null;
};

type Props = {
  countries: Country[];
  selectedCountry?: string | null;
  selectedRegionId?: string | null;
  selectedRegion?: string | null;
  /** Field IDs (must stay in lockstep with the surrounding `<label for>` values). */
  idPrefix?: string;
  required?: boolean;
};

export default function RegionSelect({
  countries,
  selectedCountry,
  selectedRegionId,
  selectedRegion,
  idPrefix = "addr",
  required = true,
}: Props) {
  const [country, setCountry] = useState<string>(
    selectedCountry ?? countries[0]?.id ?? "US",
  );
  const [regionId, setRegionId] = useState<string>(selectedRegionId ?? "");
  const [regionText, setRegionText] = useState<string>(selectedRegion ?? "");

  const regionsByCountry = useMemo(() => {
    const map: Record<string, Region[]> = {};
    for (const c of countries) {
      if (!c.id) continue;
      map[c.id] = c.available_regions ?? [];
    }
    return map;
  }, [countries]);

  const currentRegions: Region[] = regionsByCountry[country] ?? [];
  const hasRegions = currentRegions.length > 0;

  return (
    <>
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idPrefix}-country_code`}
          className="text-sm font-medium text-zinc-800"
        >
          Country {required && <span className="text-red-600" aria-hidden="true">*</span>}
        </label>
        <select
          id={`${idPrefix}-country_code`}
          name="country_code"
          required={required}
          value={country}
          onChange={(e) => {
            setCountry(e.currentTarget.value);
            setRegionId("");
            setRegionText("");
          }}
          autoComplete="country"
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
        >
          {countries.length === 0 && <option value={country}>{country}</option>}
          {countries.map((c) => (
            <option key={c.id ?? ""} value={c.id ?? ""}>
              {c.full_name_english ?? c.id}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={hasRegions ? `${idPrefix}-region_id` : `${idPrefix}-region`}
          className="text-sm font-medium text-zinc-800"
        >
          State / Province {required && hasRegions && (
            <span className="text-red-600" aria-hidden="true">*</span>
          )}
        </label>
        {hasRegions ? (
          <>
            <select
              id={`${idPrefix}-region_id`}
              name="region_id"
              required={required}
              value={regionId}
              onChange={(e) => setRegionId(e.currentTarget.value)}
              autoComplete="address-level1"
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            >
              <option value="">— Please select —</option>
              {currentRegions.map((r) => (
                <option key={r.id ?? r.code ?? r.name ?? ""} value={r.id ?? ""}>
                  {r.name ?? r.code ?? ""}
                </option>
              ))}
            </select>
            {/* Keep `region` in the form body as empty so the server-side parser
                doesn't see a stale value from a previous country selection. */}
            <input type="hidden" name="region" value="" />
          </>
        ) : (
          <>
            <input
              id={`${idPrefix}-region`}
              name="region"
              type="text"
              value={regionText}
              onChange={(e) => setRegionText(e.currentTarget.value)}
              placeholder="State / Province"
              autoComplete="address-level1"
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
            <input type="hidden" name="region_id" value="" />
          </>
        )}
      </div>
    </>
  );
}
