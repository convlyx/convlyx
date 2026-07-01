import { LEGAL_VERSIONS } from "./legal";

/** The version snapshot stored in ConsentRecord.documentVersions. */
export type StoredVersions = { terms?: string; privacy?: string; dpa?: string };

/** A USER_TERMS record satisfies current requirements iff both terms+privacy match. */
export function userTermsSatisfied(v: StoredVersions | null): boolean {
  if (!v) return false;
  return v.terms === LEGAL_VERSIONS.terms && v.privacy === LEGAL_VERSIONS.privacy;
}

/** A CONTROLLER_DPA record satisfies current requirements iff both terms+dpa match. */
export function controllerDpaSatisfied(v: StoredVersions | null): boolean {
  if (!v) return false;
  return v.terms === LEGAL_VERSIONS.terms && v.dpa === LEGAL_VERSIONS.dpa;
}
