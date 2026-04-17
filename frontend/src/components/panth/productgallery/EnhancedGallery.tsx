/**
 * EnhancedGallery.tsx — `Panth_ProductgalleryReact` PDP image gallery.
 *
 * INTEGRATION (comment-only, never auto-wire):
 *   import EnhancedGallery from "~/components/panth/productgallery/EnhancedGallery";
 *   <EnhancedGallery
 *     client:visible
 *     images={extractPanthGallery(productView.p)}
 *     fallback={productView.gallery}
 *     productName={productView.p.name}
 *   />
 *
 * Features:
 *   - Thumbnail strip (lazy-loaded, width/height).
 *   - Hover zoom on desktop (`background-image` pan on pointer-move).
 *   - Pinch-zoom modal on mobile (full-screen <img> + native touch scaling via
 *     CSS `touch-action: pan-x pan-y pinch-zoom`).
 *   - HTML5 <video> with play-button overlay for video slides.
 *   - Hydration-safe: mobile/desktop branching keyed off `hasMounted` so the
 *     first paint is SSR-stable.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import type { PanthGalleryImageT } from "~/lib/queries-productgallery";

type FallbackImage = { url: string; label: string | null };

interface Props {
  images: PanthGalleryImageT[];
  fallback?: FallbackImage[];
  productName: string;
}

const MAIN_W = 800;
const MAIN_H = 800;
const THUMB_W = 120;
const THUMB_H = 120;
const MOBILE_MQ = "(max-width: 768px)";

function normalizeFallback(list: FallbackImage[]): PanthGalleryImageT[] {
  return list
    .filter((f) => typeof f.url === "string" && f.url.length > 0)
    .map((f, i) => ({
      url: f.url,
      label: f.label ?? "",
      zoomUrl: null,
      videoUrl: null,
      poster: null,
      isVideo: false,
      position: i,
    }));
}

export default function EnhancedGallery({
  images,
  fallback = [],
  productName,
}: Props): ReactElement | null {
  const list = useMemo<PanthGalleryImageT[]>(() => {
    if (images.length > 0) return images;
    return normalizeFallback(fallback);
  }, [images, fallback]);

  const [hasMounted, setHasMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [active, setActive] = useState(0);
  const [zoomOn, setZoomOn] = useState(false);
  const [zoomPos, setZoomPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [modalOpen, setModalOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const stageId = `panth-gallery-${uid.replace(/[:]/g, "")}`;

  useEffect(() => {
    setHasMounted(true);
    const mql = window.matchMedia(MOBILE_MQ);
    const update = (): void => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    // Reset index when the list identity changes (e.g. configurable swap).
    setActive(0);
  }, [list]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  const onMove = useCallback((e: ReactPointerEvent<HTMLDivElement>): void => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }, []);

  if (list.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
        No image
      </div>
    );
  }

  const current = list[active] ?? list[0]!;
  const altText = current.label || productName;
  const zoomSrc = current.zoomUrl ?? current.url;
  const showZoomDesktop = hasMounted && !isMobile && !current.isVideo && zoomOn;

  return (
    <div className="panth-enhanced-gallery" id={stageId}>
      <div
        ref={stageRef}
        className="relative aspect-square overflow-hidden rounded-2xl bg-zinc-100"
        onPointerEnter={() => setZoomOn(true)}
        onPointerLeave={() => setZoomOn(false)}
        onPointerMove={onMove}
        onClick={() => {
          if (hasMounted && isMobile && !current.isVideo) setModalOpen(true);
        }}
      >
        {current.isVideo && current.videoUrl ? (
          <video
            src={current.videoUrl}
            poster={current.poster ?? undefined}
            controls
            preload="metadata"
            width={MAIN_W}
            height={MAIN_H}
            className="h-full w-full object-cover"
            aria-label={altText}
          >
            <track kind="captions" />
          </video>
        ) : (
          <>
            <img
              src={current.url}
              alt={altText}
              width={MAIN_W}
              height={MAIN_H}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="h-full w-full object-cover"
            />
            {showZoomDesktop && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: `url(${zoomSrc})`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "200%",
                  backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                }}
              />
            )}
            {hasMounted && isMobile && (
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-zinc-700 shadow"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" strokeLinecap="round" />
                </svg>
              </span>
            )}
          </>
        )}
      </div>

      {list.length > 1 && (
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="Product media thumbnails">
          {list.map((img, i) => (
            <li key={`${stageId}-${i}`}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${list.length}`}
                aria-pressed={i === active}
                className={
                  "relative block aspect-square w-full overflow-hidden rounded-lg border bg-zinc-100 transition " +
                  (i === active
                    ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/30"
                    : "border-zinc-200 hover:border-zinc-400")
                }
              >
                <img
                  src={img.poster ?? img.url}
                  alt={img.label || `${productName} thumbnail ${i + 1}`}
                  width={THUMB_W}
                  height={THUMB_H}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                {img.isVideo && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 grid place-items-center bg-black/30 text-white"
                  >
                    <svg className="size-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && hasMounted && isMobile && !current.isVideo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Zoom: ${altText}`}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-2"
          onClick={() => setModalOpen(false)}
        >
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            aria-label="Close zoom"
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/90 text-zinc-700 shadow"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div
            className="max-h-full max-w-full overflow-auto"
            style={{ touchAction: "pan-x pan-y pinch-zoom" }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomSrc}
              alt={altText}
              width={MAIN_W * 2}
              height={MAIN_H * 2}
              loading="eager"
              decoding="async"
              className="h-auto w-auto max-w-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
