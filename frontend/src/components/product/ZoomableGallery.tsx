// PDP integration (inside src/pages/[...slug].astro PRODUCT branch):
//   import ZoomableGallery from "~/components/product/ZoomableGallery.tsx";
//   import VariantImageSync from "~/components/product/VariantImageSync.tsx";
//   <ZoomableGallery client:visible images={productView.gallery} productName={productView.p.name} />
//   {productView.p.__typename === "ConfigurableProduct" && <VariantImageSync client:idle />}
//
// Optional: if the integration agent is able to also edit ConfigurableOptions,
// emit a CustomEvent("m2r:gallery-swap", { detail: { url: variantImageUrl } })
// on the window whenever a full variant is selected. VariantImageSync handles
// the rest.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";

type GalleryImage = {
  url: string;
  label: string | null;
};

type Props = {
  images: GalleryImage[];
  initialIndex?: number;
  productName: string;
};

type GallerySwapDetail = {
  url: string;
};

const ZOOM_FACTOR = 2.5;
const MAIN_SIZE = 800;
const THUMB_SIZE = 160;
const MOBILE_BREAKPOINT = "(max-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function isGallerySwapDetail(value: unknown): value is GallerySwapDetail {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.url === "string" && record.url.length > 0;
}

export default function ZoomableGallery({
  images,
  initialIndex = 0,
  productName,
}: Props): ReactElement {
  const [list, setList] = useState<GalleryImage[]>(images);
  const [activeIndex, setActiveIndex] = useState<number>(
    Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)),
  );
  const [hovering, setHovering] = useState<boolean>(false);
  const [lensPos, setLensPos] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const mainImageRef = useRef<HTMLImageElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const modalCloseRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Keep local list in sync when props change (e.g. SPA nav to another PDP).
  useEffect(() => {
    setList(images);
    setActiveIndex(
      Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)),
    );
  }, [images, initialIndex]);

  // Media query listeners (mobile + reduced motion).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mobileMq = window.matchMedia(MOBILE_BREAKPOINT);
    const motionMq = window.matchMedia(REDUCED_MOTION_QUERY);

    const handleMobile = (e: MediaQueryListEvent | MediaQueryList): void => {
      setIsMobile(e.matches);
    };
    const handleMotion = (e: MediaQueryListEvent | MediaQueryList): void => {
      setReducedMotion(e.matches);
    };

    handleMobile(mobileMq);
    handleMotion(motionMq);

    mobileMq.addEventListener("change", handleMobile);
    motionMq.addEventListener("change", handleMotion);
    return () => {
      mobileMq.removeEventListener("change", handleMobile);
      motionMq.removeEventListener("change", handleMotion);
    };
  }, []);

  // Listen for external variant-image swaps.
  useEffect(() => {
    function onSwap(event: Event): void {
      const custom = event as CustomEvent<unknown>;
      if (!isGallerySwapDetail(custom.detail)) return;
      const url = custom.detail.url;
      setList((prev) => {
        const existingIdx = prev.findIndex((img) => img.url === url);
        if (existingIdx >= 0) {
          setActiveIndex(existingIdx);
          return prev;
        }
        setActiveIndex(0);
        return [{ url, label: productName }, ...prev];
      });
    }
    window.addEventListener("m2r:gallery-swap", onSwap);
    return () => window.removeEventListener("m2r:gallery-swap", onSwap);
  }, [productName]);

  // Focus trap + Esc handling for the modal.
  useEffect(() => {
    if (!modalOpen) return;
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    modalCloseRef.current?.focus();

    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        setModalOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const root = modalRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [modalOpen]);

  const active = list[activeIndex] ?? list[0];

  const onMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement> | ReactPointerEvent<HTMLDivElement>) => {
      if (isMobile || reducedMotion) return;
      const target = e.currentTarget;
      const rect = target.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setLensPos({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      });
    },
    [isMobile, reducedMotion],
  );

  const openModal = useCallback(() => {
    if (!isMobile) return;
    setModalOpen(true);
  }, [isMobile]);

  const onMainKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (!isMobile) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setModalOpen(true);
      }
    },
    [isMobile],
  );

  const zoomStyle: CSSProperties | undefined = useMemo(() => {
    if (!active) return undefined;
    return {
      backgroundImage: `url("${active.url}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: `${ZOOM_FACTOR * 100}%`,
      backgroundPosition: `${lensPos.x}% ${lensPos.y}%`,
    };
  }, [active, lensPos.x, lensPos.y]);

  if (list.length === 0 || !active) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
        No image
      </div>
    );
  }

  const showZoomPanel = hovering && !isMobile && !reducedMotion;

  return (
    <div className="zoomable-gallery">
      <div className="relative flex gap-4">
        <div className="min-w-0 flex-1">
          <div
            className="relative aspect-square overflow-hidden rounded-2xl bg-zinc-100"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onMouseMove={onMouseMove}
            onPointerMove={onMouseMove}
            style={{
              cursor: isMobile ? "zoom-in" : "crosshair",
            }}
          >
            <button
              type="button"
              className="absolute inset-0 block h-full w-full p-0"
              onClick={openModal}
              onKeyDown={onMainKeyDown}
              aria-label={
                isMobile
                  ? `Open ${productName} image in full screen`
                  : `${productName} image`
              }
              tabIndex={isMobile ? 0 : -1}
              style={{
                cursor: isMobile ? "zoom-in" : "crosshair",
                background: "transparent",
                border: 0,
              }}
            >
              <img
                ref={mainImageRef}
                src={active.url}
                alt={active.label ?? productName}
                width={MAIN_SIZE}
                height={MAIN_SIZE}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
                draggable={false}
              />
            </button>
          </div>

          {list.length > 1 && (
            <ul
              className="mt-4 grid grid-cols-5 gap-3"
              aria-label="Product images"
            >
              {list.slice(0, 10).map((img, idx) => {
                const pressed = idx === activeIndex;
                return (
                  <li key={`${img.url}-${idx}`}>
                    <button
                      type="button"
                      aria-pressed={pressed}
                      aria-label={img.label ?? `${productName} image ${idx + 1}`}
                      onClick={() => setActiveIndex(idx)}
                      className={`block aspect-square w-full overflow-hidden rounded-lg border bg-zinc-100 transition ${
                        pressed
                          ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]"
                          : "border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.label ?? productName}
                        width={THUMB_SIZE}
                        height={THUMB_SIZE}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {showZoomPanel && (
          <div
            aria-hidden="true"
            className="pointer-events-none hidden aspect-square flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:block"
            style={zoomStyle}
          />
        )}
      </div>

      {modalOpen && isMobile && (
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} image viewer`}
          className="fixed inset-0 z-50 flex flex-col bg-black"
        >
          <div className="flex items-center justify-between p-3 text-white">
            <span className="text-sm">
              {activeIndex + 1} / {list.length}
            </span>
            <button
              ref={modalCloseRef}
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
              aria-label="Close image viewer"
            >
              Close
            </button>
          </div>

          <div
            className="relative flex-1"
            style={{ overflow: "auto", touchAction: "pinch-zoom" }}
          >
            <img
              src={active.url}
              alt={active.label ?? productName}
              width={MAIN_SIZE * 2}
              height={MAIN_SIZE * 2}
              decoding="async"
              className="mx-auto block max-w-none"
              style={{
                width: "100vw",
                height: "auto",
                minHeight: "100%",
                objectFit: "contain",
              }}
              draggable={false}
            />
          </div>

          {list.length > 1 && (
            <ul
              className="flex gap-2 overflow-x-auto bg-black/90 p-3"
              aria-label="Product images"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {list.map((img, idx) => {
                const pressed = idx === activeIndex;
                return (
                  <li
                    key={`m-${img.url}-${idx}`}
                    style={{ scrollSnapAlign: "start" }}
                  >
                    <button
                      type="button"
                      aria-pressed={pressed}
                      aria-label={img.label ?? `${productName} image ${idx + 1}`}
                      onClick={() => setActiveIndex(idx)}
                      className={`block h-16 w-16 shrink-0 overflow-hidden rounded-md border transition ${
                        pressed
                          ? "border-[var(--color-brand)]"
                          : "border-white/20"
                      }`}
                    >
                      <img
                        src={img.url}
                        alt={img.label ?? productName}
                        width={THUMB_SIZE}
                        height={THUMB_SIZE}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
