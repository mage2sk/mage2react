import { z } from "zod";
import { query } from "./graphql";

/**
 * queries-advanced-contact-us.ts
 *
 * Typed helper for `Panth_AdvancedContactUs`. The parent module is expected
 * to expose a `panthContactConfig` GraphQL query returning the admin-
 * configured contact form (custom fields, subject options, office info,
 * embedded map).
 *
 * We do not own the parent schema, so every field is
 * `.nullable().optional()`; `safeParse` + safe empty fallback is the rule.
 */

/* -------------------------------------------------------------------------- */
/* Field-type allowlist                                                       */
/* -------------------------------------------------------------------------- */

export const CONTACT_FIELD_TYPES = [
  "text",
  "email",
  "tel",
  "textarea",
  "select",
  "checkbox",
  "radio",
] as const;

export type ContactFieldType = (typeof CONTACT_FIELD_TYPES)[number];

function isContactFieldType(v: unknown): v is ContactFieldType {
  return typeof v === "string" && (CONTACT_FIELD_TYPES as readonly string[]).includes(v);
}

/* -------------------------------------------------------------------------- */
/* Zod schemas                                                                */
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
  options: z.array(Option).nullable().optional(),
});

const Envelope = z.object({
  panthContactConfig: z
    .object({
      fields: z.array(RawField).nullable().optional(),
      subject_options: z.array(z.string()).nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      hours: z.string().nullable().optional(),
      map_embed_url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface ContactFieldOption {
  value: string;
  label: string;
}

export interface ContactField {
  id: string;
  label: string;
  type: ContactFieldType;
  required: boolean;
  placeholder: string | null;
  options: ContactFieldOption[];
}

export interface ContactConfig {
  fields: ContactField[];
  subject_options: string[];
  phone: string | null;
  email: string | null;
  hours: string | null;
  map_embed_url: string | null;
}

export const EMPTY_CONTACT_CONFIG: ContactConfig = {
  fields: [],
  subject_options: [],
  phone: null,
  email: null,
  hours: null,
  map_embed_url: null,
};

/* -------------------------------------------------------------------------- */
/* One-shot warning                                                           */
/* -------------------------------------------------------------------------- */

let warnedMissing = false;
function logSchemaMiss(err: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  const msg = err instanceof Error ? err.message : String(err);
  if (/Cannot query field|Unknown type|not exist/i.test(msg)) {
    console.warn(
      "[panth-advanced-contact-us] panthContactConfig field missing — install/enable Panth_AdvancedContactUs.",
    );
  } else {
    console.warn("[panth-advanced-contact-us] query failed:", msg);
  }
}

/* -------------------------------------------------------------------------- */
/* Coercion                                                                   */
/* -------------------------------------------------------------------------- */

function coerceField(raw: z.infer<typeof RawField>, idx: number): ContactField | null {
  const rawId = raw.id;
  const id = typeof rawId === "number" ? String(rawId) : (rawId ?? "").trim();
  const type = isContactFieldType(raw.type) ? raw.type : "text";
  const label = (raw.label ?? "").trim();
  if (!label) return null;
  const options: ContactFieldOption[] = [];
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
    options,
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Returns the admin-configured contact form config. Never throws. On any
 * error or schema mismatch, returns `EMPTY_CONTACT_CONFIG` so callers can
 * render a minimal form (or skip rendering entirely).
 */
export async function getContactConfig(): Promise<ContactConfig> {
  const doc = /* GraphQL */ `
    query PanthContactConfig {
      panthContactConfig {
        fields {
          id
          label
          type
          required
          placeholder
          options {
            value
            label
          }
        }
        subject_options
        phone
        email
        hours
        map_embed_url
      }
    }
  `;

  try {
    const raw = await query<unknown>(doc, {});
    const parsed = Envelope.safeParse(raw);
    if (!parsed.success) return EMPTY_CONTACT_CONFIG;
    const env = parsed.data.panthContactConfig;
    if (!env) return EMPTY_CONTACT_CONFIG;

    const fields: ContactField[] = [];
    (env.fields ?? []).forEach((f, idx) => {
      if (!f) return;
      const c = coerceField(f, idx);
      if (c) fields.push(c);
    });

    const subjects: string[] = [];
    for (const s of env.subject_options ?? []) {
      const v = (s ?? "").trim();
      if (v) subjects.push(v);
    }

    return {
      fields,
      subject_options: subjects,
      phone: env.phone?.trim() || null,
      email: env.email?.trim() || null,
      hours: env.hours?.trim() || null,
      map_embed_url: env.map_embed_url?.trim() || null,
    };
  } catch (err) {
    logSchemaMiss(err);
    return EMPTY_CONTACT_CONFIG;
  }
}

/* -------------------------------------------------------------------------- */
/* Validator builder — used by both the form and the API endpoint             */
/* -------------------------------------------------------------------------- */

/**
 * Builds a per-field Zod schema for runtime validation. `text`, `email`,
 * `tel`, `textarea` collapse to strings; `select`/`radio` require the value
 * to be one of the declared options; `checkbox` accepts `"on" | "off"` /
 * boolean-ish.
 */
export function buildFieldValidator(field: ContactField): z.ZodTypeAny {
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
    case "textarea": {
      const base = z.string().trim().max(5_000);
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
    default: {
      const base = z.string().trim().max(1_000);
      return field.required ? base.min(1, "This field is required.") : base.nullable().optional();
    }
  }
}
