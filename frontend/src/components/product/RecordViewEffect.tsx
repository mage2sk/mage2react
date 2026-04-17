import { useEffect } from "react";
import { recordView } from "~/lib/recently-viewed-store";

/**
 * Invisible PDP effect: records a product view once on mount.
 *
 * Place inside the PDP branch of `src/pages/[...slug].astro` with
 * `client:idle` so the record runs after the browser is idle — it's pure
 * local-storage bookkeeping and has no visual output.
 */

type Props = {
  sku: string;
};

export default function RecordViewEffect({ sku }: Props): null {
  useEffect(() => {
    recordView(sku);
  }, [sku]);
  return null;
}
