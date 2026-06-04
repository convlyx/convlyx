/**
 * Single source of truth for legal-entity information shown on the
 * privacy / terms / cookies pages. Update this file when the legal
 * registration is complete; the legal pages will pick it up automatically.
 *
 * Until `taxId` and `address` are filled in, the legal pages render a
 * "(em registo)" placeholder so it's clear that registration is in
 * progress without breaking GDPR-required disclosures.
 */

export const COMPANY = {
  /** Brand / trading name shown to users. */
  brandName: "Convlyx",

  /** Registered legal entity name. For a sole trader (empresário em nome
   *  individual) this is the person's full name as registered. */
  legalName: "Pedro Caetano Laúdo",

  /** Legal form of the entity. Determines the tax-id label:
   *  "individual" → "NIF", "company" → "NIPC". */
  entityType: "individual",

  /** Portuguese tax number (NIF for sole traders, NIPC for companies).
   *  Leave empty until registration is complete. */
  taxId: "248565117",

  /** Registered street address in Portugal. Leave empty until known. */
  address: "Rua Principal n.º 713, Chã Laranjeira, 2425-821 Souto da Carpalhosa, Leiria",

  /** District whose court has jurisdiction for any litigation. Used in
   *  the Terms & Conditions "foro" clause. Update when registered. */
  jurisdictionDistrict: "Leiria",

  /** Primary contact email shown across the legal pages. */
  contactEmail: "convlyx@gmail.com",
} as const;

/** Tax-id label appropriate to the entity type ("NIF" or "NIPC"). */
export function taxIdLabel(): string {
  return (COMPANY.entityType as string) === "company" ? "NIPC" : "NIF";
}

/**
 * Format the legal-entity line shown in the "Quem somos" section of
 * each legal page. Examples:
 *   - With taxId + address: "Pedro Caetano Laudo (NIF 248565117, Rua X, 1000 Leiria)"
 *   - Without:              "Pedro Caetano Laudo (entidade em registo)"
 */
export function formatLegalEntity(): string {
  const parts: string[] = [];
  if (COMPANY.taxId) parts.push(`${taxIdLabel()} ${COMPANY.taxId}`);
  if (COMPANY.address) parts.push(COMPANY.address);
  if (parts.length === 0) {
    return `${COMPANY.legalName} (entidade em registo)`;
  }
  return `${COMPANY.legalName} (${parts.join(", ")})`;
}
