/**
 * useZipValidation.ts
 *
 * Panth_ZipcodeValidationReact — debounced validation hook for postal
 * codes. Calls the extended `panthValidateZipcode` query and falls back
 * to an offline regex heuristic when the parent module is unavailable or
 * the network is slow.
 *
 * Returns a stable state machine:
 *   idle    — no input or still waiting for debounce
 *   loading — request in flight
 *   valid   — server returned `valid: true`, `message` + `regionHint` are
 *             safe to display (text only — never innerHTML)
 *   invalid — server returned `valid: false`
 *
 * This hook is ADVISORY UX only. The server remains the source of truth
 * at place-order time; we never block form submission from here.
 */
import { useEffect, useRef, useState } from "react";
import { heuristicZipValid, validateZipcode } from "~/lib/queries-zipcode-validation";

export type ZipValidationState = "idle" | "loading" | "valid" | "invalid";

export interface ZipValidationSnapshot {
  state: ZipValidationState;
  message: string | null;
  regionHint: string | null;
}

const IDLE: ZipValidationSnapshot = { state: "idle", message: null, regionHint: null };

interface Options {
  /** Debounce window in ms. Defaults to 450. */
  debounceMs?: number;
  /** Minimum length to attempt validation. Defaults to 3. */
  minLength?: number;
}

export function useZipValidation(
  zip: string,
  country: string | null | undefined,
  { debounceMs = 450, minLength = 3 }: Options = {},
): ZipValidationSnapshot {
  const [snapshot, setSnapshot] = useState<ZipValidationSnapshot>(IDLE);
  const latestRef = useRef<{ zip: string; country: string }>({ zip: "", country: "" });

  useEffect(() => {
    const z = zip.trim();
    const c = (country ?? "").trim().toUpperCase();
    latestRef.current = { zip: z, country: c };

    if (!z || !c || z.length < minLength) {
      setSnapshot(IDLE);
      return;
    }

    // Quick offline heuristic — if the pattern clearly fails for the known
    // country, mark invalid instantly without hitting the network.
    const passesHeuristic = heuristicZipValid(z, c);
    setSnapshot({ state: "loading", message: null, regionHint: null });

    const handle = setTimeout(() => {
      void (async () => {
        try {
          const result = await validateZipcode(z, c);
          // Guard against racing input — the user may have typed something
          // else by the time this resolves.
          if (latestRef.current.zip !== z || latestRef.current.country !== c) return;
          if (result == null) {
            // Fall back to heuristic-only if the server said nothing.
            setSnapshot({
              state: passesHeuristic ? "idle" : "invalid",
              message: passesHeuristic ? null : "Please enter a valid postal code.",
              regionHint: null,
            });
            return;
          }
          if (result.valid) {
            const region = result.state ?? result.region_code ?? null;
            setSnapshot({
              state: "valid",
              message: result.message ?? null,
              regionHint: region,
            });
          } else {
            setSnapshot({
              state: "invalid",
              message: result.message ?? "Please enter a valid postal code.",
              regionHint: null,
            });
          }
        } catch {
          if (latestRef.current.zip !== z || latestRef.current.country !== c) return;
          setSnapshot({
            state: passesHeuristic ? "idle" : "invalid",
            message: passesHeuristic ? null : "Please enter a valid postal code.",
            regionHint: null,
          });
        }
      })();
    }, debounceMs);

    return () => clearTimeout(handle);
  }, [zip, country, debounceMs, minLength]);

  return snapshot;
}
