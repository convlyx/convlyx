/**
 * Single source of truth for legal-entity information shown on the
 * privacy / terms / cookies pages. Update this file when the legal
 * registration is complete; the legal pages will pick it up automatically.
 *
 * Until `nipc` and `address` are filled in, the legal pages render a
 * "(em registo)" placeholder so it's clear that registration is in
 * progress without breaking GDPR-required disclosures.
 */

export const COMPANY = {
  /** Brand / trading name shown to users. */
  brandName: "Convlyx",

  /** Registered legal entity name. For now, equal to the trading name —
   *  update to the sole trader's full registered name when known. */
  legalName: "Convlyx",

  /** Portuguese tax number (NIPC for companies, NIF for sole traders).
   *  Leave empty until registration is complete. */
  nipc: "",

  /** Registered street address in Portugal. Leave empty until known. */
  address: "",

  /** District whose court has jurisdiction for any litigation. Used in
   *  the Terms & Conditions "foro" clause. Update when registered. */
  jurisdictionDistrict: "Leiria",

  /** Primary contact email shown across the legal pages. */
  contactEmail: "convlyx@gmail.com",
} as const;

/**
 * Format the legal-entity line shown in the "Quem somos" section of
 * each legal page. Examples:
 *   - With NIPC + address: "Convlyx (NIPC 123456789, Rua X, 1000 Lisboa)"
 *   - Without:             "Convlyx (entidade em registo)"
 */
export function formatLegalEntity(): string {
  const parts: string[] = [];
  if (COMPANY.nipc) parts.push(`NIPC ${COMPANY.nipc}`);
  if (COMPANY.address) parts.push(COMPANY.address);
  if (parts.length === 0) {
    return `${COMPANY.legalName} (entidade em registo)`;
  }
  return `${COMPANY.legalName} (${parts.join(", ")})`;
}
