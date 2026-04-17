import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import type { RatingMetadataItemT } from "~/lib/queries-reviews";

type Props = {
  sku: string;
  metadata: RatingMetadataItemT[];
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  userErrors?: { code: string | null; message: string }[];
};

const FormSchema = z.object({
  sku: z.string().min(1),
  nickname: z.string().trim().min(2, "Please enter a nickname (at least 2 characters).").max(128),
  summary: z.string().trim().min(3, "Please enter a short summary.").max(255),
  text: z
    .string()
    .trim()
    .min(25, "Please write at least 25 characters.")
    .max(2000, "Please keep the review under 2000 characters."),
  ratings: z
    .array(z.object({ id: z.string().min(1), value_id: z.string().min(1) }))
    .min(1, "Please rate every category."),
});

const TEXT_MIN = 25;
const TEXT_MAX = 2000;

/**
 * Five-pointed star path for the rating buttons.
 */
const STAR_D =
  "M12 2l2.9 6.9 7.1.6-5.4 4.8 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.5l7.1-.6L12 2z";

function StarButton({
  filled,
  onClick,
  ariaLabel,
}: {
  filled: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        viewBox="0 0 24 24"
        className={filled ? "text-amber-400" : "text-zinc-300"}
        fill="currentColor"
      >
        <path d={STAR_D} />
      </svg>
    </button>
  );
}

export default function ReviewForm({ sku, metadata }: Props) {
  const [nickname, setNickname] = useState("");
  const [summary, setSummary] = useState("");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Sort the rating values by numeric ascending so 1–5 is always in order.
  const groups = useMemo(
    () =>
      metadata.map((g) => ({
        id: g.id,
        name: g.name ?? "Rating",
        values: [...g.values].sort((a, b) => {
          const av = Number(a.value ?? "0");
          const bv = Number(b.value ?? "0");
          return av - bv;
        }),
      })),
    [metadata],
  );

  function selectRating(groupId: string, valueId: string): void {
    setSelected((s) => ({ ...s, [groupId]: valueId }));
  }

  function getSelectedNumeric(groupId: string): number {
    const vid = selected[groupId];
    if (!vid) return 0;
    const g = groups.find((x) => x.id === groupId);
    if (!g) return 0;
    const idx = g.values.findIndex((v) => v.value_id === vid);
    return idx >= 0 ? idx + 1 : 0;
  }

  function reset(): void {
    setNickname("");
    setSummary("");
    setText("");
    setSelected({});
    setErrors([]);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors([]);
    setSuccess(null);

    const ratings = Object.entries(selected).map(([id, value_id]) => ({
      id,
      value_id,
    }));

    // Every metadata group must be rated.
    if (ratings.length < groups.length) {
      setErrors(["Please rate every category before submitting."]);
      return;
    }

    const parsed = FormSchema.safeParse({
      sku,
      nickname,
      summary,
      text,
      ratings,
    });
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json()) as ApiResponse;
      if (!res.ok || !body.ok) {
        const errs =
          body.userErrors && body.userErrors.length > 0
            ? body.userErrors.map((e) => e.message)
            : [body.message ?? "We couldn't submit your review. Please try again."];
        setErrors(errs);
        return;
      }
      setSuccess(
        body.message ?? "Thanks — your review is pending moderation.",
      );
      reset();
    } catch {
      setErrors(["Network error. Please try again."]);
    } finally {
      setPending(false);
    }
  }

  const textLen = text.trim().length;

  return (
    <section className="mt-10 rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-zinc-900">Write a review</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Share your experience with this product to help other shoppers.
      </p>

      <form className="mt-5 space-y-5" onSubmit={onSubmit} noValidate>
        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.map((g) => {
              const sel = getSelectedNumeric(g.id);
              return (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center gap-3"
                  role="group"
                  aria-label={`${g.name} rating`}
                >
                  <span className="min-w-[6rem] text-sm font-medium text-zinc-700">
                    {g.name}
                  </span>
                  <div className="flex items-center" aria-label={`${g.name} — ${sel} of ${g.values.length}`}>
                    {g.values.map((v, idx) => (
                      <StarButton
                        key={v.value_id}
                        filled={idx < sel}
                        ariaLabel={`${g.name} ${idx + 1} of ${g.values.length}`}
                        onClick={() => selectRating(g.id, v.value_id)}
                      />
                    ))}
                  </div>
                  {sel > 0 && (
                    <span className="text-xs text-zinc-500">{sel} / {g.values.length}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div>
          <label
            htmlFor="review-nickname"
            className="block text-sm font-medium text-zinc-700"
          >
            Nickname
          </label>
          <input
            id="review-nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={128}
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label
            htmlFor="review-summary"
            className="block text-sm font-medium text-zinc-700"
          >
            Summary
          </label>
          <input
            id="review-summary"
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={255}
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        <div>
          <label
            htmlFor="review-text"
            className="block text-sm font-medium text-zinc-700"
          >
            Your review
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            minLength={TEXT_MIN}
            maxLength={TEXT_MAX}
            rows={6}
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
          <p className="mt-1 text-xs text-zinc-500">
            {textLen} / {TEXT_MAX} characters (minimum {TEXT_MIN})
          </p>
        </div>

        {errors.length > 0 && (
          <ul
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        {success && (
          <div
            role="status"
            className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {success}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-brand)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-dark)] disabled:opacity-60"
          >
            {pending ? "Submitting\u2026" : "Submit review"}
          </button>
        </div>
      </form>
    </section>
  );
}
