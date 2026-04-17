import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-dynamic-forms.ts
 *
 * Typed helpers for `Panth_DynamicForms`. The parent module is expected to
 * expose:
 *   - `panthDynamicForm(slug: String!)` — returns the form definition.
 *   - `panthDynamicFormSubmit(input: PanthDynamicFormSubmitInput!)` —
 *     records a submission.
 *
 * Parent schema is not owned here; `.nullable().optional()` everywhere,
 * `safeParse` + safe empty fallback.
 */

export const DYNAMIC_FIELD_TYPES = [
  "text",
  "email",
  "tel",
  "number",
  "date",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "file",
] as const;

export type DynamicFieldType = (typeof DYNAMIC_FIELD_TYPES)[number];

function isDynamicFieldType(v: unknown): v is DynamicFieldType {
  return typeof v === "string" && (DYNAMIC_FIELD_TYPES as readonly string[]).includes(v);
}

/* -------------------------------------------------------------------------- */
/* Zod                                                                         */
/* -------------------------------------------------------------------------- */

const Option = z.object({
  value: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
});

const RawField = z.object({
  id: z.union([z.string(), z.number()]).nullable().optional(),
  label: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  required: z.boolean().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  help_text: z.string().nullable().optional(),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  options: z.array(Option).nullable().optional(),
});

const Envelope = z.object({
  panthDynamicForm: z
    .object({
      slug: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      success_message: z.string().nullable().optional(),
      fields: z.array(RawField).nullable().optional(),
    })
    .nullable()
    .optional(),
});

const SubmitEnvelope = z.object({
  panthDynamicFormSubmit: z
    .object({
      ok: z.boolean().nullable().optional(),
      message: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

export interface DynamicFieldOption {
  value: string;
  label: string;
}

export interface DynamicField {
  id: string;
  label: string;
  type: DynamicFieldType;
  required: boolean;
  placeholder: string | null;
  help_text: string | null;
  min: number | null;
  max: number | null;
  options: DynamicFieldOption[];
}

export interface DynamicForm {
  slug: string;
  title: string;
  description: string | null;
  success_message: string;
  fields: DynamicField[];
}

export interface SubmitResult {
  ok: boolean;
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Coercion                                                                    */
/* -------------------------------------------------------------------------- */

function coerceField(raw: z.infer<typeof RawField>, idx: number): DynamicField | null {
  const rawId = raw.id;
  const id = typeof rawId === "number" ? String(rawId) : (rawId ?? "").trim();
  const type = isDynamicFieldType(raw.type) ? raw.type : "text";
  const label = (raw.label ?? "").trim();
  if (!label) return null;

  const options: DynamicFieldOption[] = [];
  for (const o of raw.options ?? []) {
    if (!o) continue;
    const value = (o.value ?? "").trim();
    const optLabel = (o.label ?? value).trim();
    if (!value) continue;
    options.push({ value, label: optLabel });
  }

  return {
    id: id.length ? id : `field-${idx}`,
    label,
    type,
    required: raw.required === true,
    placeholder: raw.placeholder?.trim() || null,
    help_text: raw.help_text?.trim() || null,
    min: typeof raw.min === "number" && Number.isFinite(raw.min) ? raw.min : null,
    max: typeof raw.max === "number" && Number.isFinite(raw.max) ? raw.max : null,
    options,
  };
}

/* -------------------------------------------------------------------------- */
/* Warnings                                                                    */
/* -------------------------------------------------------------------------- */

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-dynamic-forms] panthDynamicForm field missing — install/enable Panth_DynamicForms.",
    );
  } else {
    console.warn("[panth-dynamic-forms] query failed:", msg);
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Fetch an admin-defined dynamic form by its slug. Never throws; returns
 * `null` when the form doesn't exist or the parent module isn't installed.
 */
export async function getDynamicForm(slug: string): Promise<DynamicForm | null> {
  if (!slug || typeof slug !== "string") return null;
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const doc = /* GraphQL */ `
    query PanthDynamicForm($slug: String!) {
      panthDynamicForm(slug: $slug) {
        slug
        title
        description
        success_message
        fields {
          id
          label
          type
          required
          placeholder
          help_text
          min
          max
          options {
            value
            label
          }
        }
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, { slug: trimmed });
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return null;
    const env = parsed.data.panthDynamicForm;
    if (!env) return null;

    const fields: DynamicField[] = [];
    (env.fields ?? []).forEach((f, idx) => {
      if (!f) return;
      const c = coerceField(f, idx);
      if (c) fields.push(c);
    });

    if (fields.length === 0) return null;

    return {
      slug: env.slug?.trim() || trimmed,
      title: env.title?.trim() || trimmed,
      description: env.description?.trim() || null,
      success_message: env.success_message?.trim() || "Thanks — we received your submission.",
      fields,
    };
  } catch (err) {
    logSchemaMiss(err);
    return null;
  }
}

/**
 * Submit a completed dynamic form via GraphQL. Never throws; returns a
 * uniform `{ ok, message }`. File uploads must not hit this helper — use the
 * sibling `/api/panth/dynamic-forms/submit` endpoint for multipart forms.
 */
export async function submitDynamicForm(
  slug: string,
  values: Record<string, string | string[] | boolean>,
): Promise<SubmitResult> {
  const doc = /* GraphQL */ `
    mutation PanthDynamicFormSubmit($input: PanthDynamicFormSubmitInput!) {
      panthDynamicFormSubmit(input: $input) {
        ok
        message
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, {
      input: {
        slug,
        fields: Object.entries(values).map(([k, v]) => ({
          id: k,
          value: Array.isArray(v) ? v.join(",") : typeof v === "boolean" ? (v ? "true" : "false") : v,
        })),
      },
    });
    const parsed = SubmitEnvelope.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: "We could not process the submission." };
    }
    const env = parsed.data.panthDynamicFormSubmit;
    return {
      ok: env?.ok === true,
      message: env?.message?.trim() || "Thanks — we received your submission.",
    };
  } catch (err) {
    logSchemaMiss(err);
    return { ok: false, message: "We could not process the submission right now." };
  }
}

/* -------------------------------------------------------------------------- */
/* Validator builder                                                           */
/* -------------------------------------------------------------------------- */

export function buildFieldValidator(field: DynamicField): z.ZodTypeAny {
  switch (field.type) {
    case "email": {
      const base = z.string().trim().toLowerCase().email("Enter a valid email.").max(254);
      return field.required ? base : base.or(z.literal("")).nullable().optional();
    }
    case "tel": {
      const base = z
        .string()
        .trim()
        .max(32)
        .regex(/^[+0-9 ()-]{5,}$/u, "Enter a valid phone number.");
      return field.required ? base : base.or(z.literal("")).nullable().optional();
    }
    case "number": {
      let base = z.coerce.number().finite();
      if (field.min !== null) base = base.min(field.min);
      if (field.max !== null) base = base.max(field.max);
      return field.required ? base : base.nullable().optional();
    }
    case "date": {
      const base = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/u, "Enter a valid date.");
      return field.required ? base : base.or(z.literal("")).nullable().optional();
    }
    case "textarea": {
      const base = z.string().trim().max(10_000);
      return field.required ? base.min(1, "This field is required.") : base.nullable().optional();
    }
    case "select":
    case "radio": {
      const values = field.options.map((o) => o.value);
      if (values.length === 0) {
        return field.required
          ? z.string().trim().min(1, "This field is required.")
          : z.string().trim().nullable().optional();
      }
      const base = z.enum(values as [string, ...string[]]);
      return field.required ? base : base.or(z.literal("")).nullable().optional();
    }
    case "checkbox":
      return field.required
        ? z
            .union([z.literal("on"), z.literal("true"), z.literal(true), z.literal("1")])
            .transform(() => true)
        : z
            .union([z.string(), z.boolean()])
            .nullable()
            .optional()
            .transform((v) => v === true || v === "on" || v === "true" || v === "1");
    case "file":
      // Binary validation happens at the endpoint; here we just accept a
      // stringified file descriptor or nothing.
      return z.string().trim().max(512).nullable().optional();
    default: {
      const base = z.string().trim().max(2_000);
      return field.required ? base.min(1, "This field is required.") : base.nullable().optional();
    }
  }
}
