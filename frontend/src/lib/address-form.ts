import { z } from "zod";
import type { CustomerAddressInput } from "./queries-customer";

/**
 * Parses a multipart form submission into a `CustomerAddressInput` ready for
 * the Magento GraphQL `createCustomerAddress` / `updateCustomerAddress`
 * mutations. Returns either a strongly-typed input or a map of field-level
 * error messages.
 */
export const AddressFormSchema = z.object({
  firstname: z.string().trim().min(1, "Please enter a first name.").max(128),
  lastname: z.string().trim().min(1, "Please enter a last name.").max(128),
  company: z.string().trim().max(128).optional().or(z.literal("")),
  telephone: z.string().trim().min(1, "Please enter a phone number.").max(32),
  street0: z.string().trim().min(1, "Please enter a street address.").max(255),
  street1: z.string().trim().max(255).optional().or(z.literal("")),
  city: z.string().trim().min(1, "Please enter a city.").max(128),
  country_code: z.string().trim().length(2, "Please select a country."),
  region_id: z.string().trim().optional().or(z.literal("")),
  region: z.string().trim().max(128).optional().or(z.literal("")),
  postcode: z.string().trim().min(1, "Please enter a postal code.").max(32),
  default_shipping: z.string().optional(),
  default_billing: z.string().optional(),
});

export type AddressFormResult =
  | { ok: true; input: CustomerAddressInput }
  | { ok: false; values: Record<string, string>; errors: Record<string, string> };

export function parseAddressForm(form: FormData): AddressFormResult {
  const raw: Record<string, string> = {
    firstname: String(form.get("firstname") ?? "").trim(),
    lastname: String(form.get("lastname") ?? "").trim(),
    company: String(form.get("company") ?? "").trim(),
    telephone: String(form.get("telephone") ?? "").trim(),
    street0: String(form.get("street0") ?? "").trim(),
    street1: String(form.get("street1") ?? "").trim(),
    city: String(form.get("city") ?? "").trim(),
    country_code: String(form.get("country_code") ?? "").trim().toUpperCase(),
    region_id: String(form.get("region_id") ?? "").trim(),
    region: String(form.get("region") ?? "").trim(),
    postcode: String(form.get("postcode") ?? "").trim(),
    default_shipping: form.get("default_shipping") ? "1" : "",
    default_billing: form.get("default_billing") ? "1" : "",
  };
  const parsed = AddressFormSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false, values: raw, errors };
  }
  const d = parsed.data;
  const street = [d.street0, d.street1 || ""].filter((s) => s.length > 0);
  const regionId = d.region_id ? Number.parseInt(d.region_id, 10) : null;
  const regionInput: CustomerAddressInput["region"] =
    regionId && Number.isInteger(regionId)
      ? { region_id: regionId }
      : d.region
        ? { region: d.region }
        : { region: "" };
  const input: CustomerAddressInput = {
    firstname: d.firstname,
    lastname: d.lastname,
    telephone: d.telephone,
    street,
    city: d.city,
    country_code: d.country_code,
    region: regionInput,
    postcode: d.postcode,
    default_shipping: d.default_shipping === "1",
    default_billing: d.default_billing === "1",
    ...(d.company ? { company: d.company } : {}),
  };
  return { ok: true, input };
}
