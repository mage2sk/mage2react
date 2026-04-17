import { useState } from "react";

export type CardSwatchT = {
  uid: string;
  label: string;
  kind: "color" | "image";
  color: string;
  thumbnail: string | null;
};

type Props = {
  swatches: CardSwatchT[];
};

/**
 * Interactive color swatches for a product card. Clicking a swatch
 * dispatches a `m2r:card-swatch-pick` event with the matched image URL
 * so the enclosing ProductCard can update its image. We keep it headless
 * — the ProductCard reads `data-m2r-card` on its root to scope events.
 */
export default function CardSwatches({ swatches }: Props) {
  const [active, setActive] = useState<string | null>(null);
  if (swatches.length === 0) return null;

  function pick(s: CardSwatchT, e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    setActive(s.uid);
    // Bubble up via a custom event so ProductCard.astro can update <img>.
    const target = (e.currentTarget as HTMLElement).closest("[data-m2r-card]");
    const imgUrl = s.kind === "image" ? s.thumbnail : null;
    if (target && imgUrl) {
      const img = target.querySelector<HTMLImageElement>("img[data-m2r-card-img]");
      if (img) img.src = imgUrl;
    }
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1.5" aria-label="Available colors">
      {swatches.map((s) => (
        <button
          key={s.uid}
          type="button"
          onClick={(e) => pick(s, e)}
          title={s.label}
          aria-label={s.label}
          aria-pressed={active === s.uid}
          className={`inline-block size-5 rounded-full border transition ${
            active === s.uid
              ? "border-zinc-900 ring-2 ring-zinc-900 ring-offset-1"
              : "border-zinc-200 hover:border-zinc-500"
          }`}
          style={
            s.kind === "image" && s.thumbnail
              ? {
                  backgroundImage: `url(${s.thumbnail})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { backgroundColor: s.color }
          }
        />
      ))}
    </div>
  );
}
