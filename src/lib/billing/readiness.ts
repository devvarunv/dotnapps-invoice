import type { Business } from "@prisma/client";

/**
 * Spec §4: "Do not allow sending a document until required business/
 * document settings are valid." Returns the missing fields so the UI can
 * point directly at Settings → Business rather than a generic error.
 */
export function missingBusinessFieldsForSending(business: Business): string[] {
  const missing: string[] = [];
  if (!business.addressLine1?.trim()) missing.push("Address");
  if (!business.city?.trim()) missing.push("City");
  if (!business.state?.trim()) missing.push("State");
  if (!business.contactEmail?.trim() && !business.contactPhone?.trim()) {
    missing.push("Contact email or phone");
  }
  return missing;
}

export function canSendDocuments(business: Business): boolean {
  return missingBusinessFieldsForSending(business).length === 0;
}
