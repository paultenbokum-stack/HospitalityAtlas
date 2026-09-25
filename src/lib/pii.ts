// Org rule: the CRM holds business-level data only — no personal names, mobile numbers,
// personal emails or ID numbers in free text. This is a guard rail, not a guarantee: it flags
// likely personal data so the rep rewrites the note before saving.

const PATTERNS: { label: string; re: RegExp }[] = [
  // SA ID number: 13 digits (YYMMDD + 7).
  { label: "an ID number", re: /\b\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{7}\b/ },
  // Mobile numbers: +27 / 0 followed by 6x/7x/8x and 7 more digits, loosely spaced.
  { label: "a mobile number", re: /(?:\+?27|\b0)[\s-]?[678]\d(?:[\s-]?\d){7}\b/ },
  // Named-person email (first.last@ / firstname@) — generic role inboxes are allowed.
  { label: "a personal email address", re: /\b(?!(?:info|hello|bookings?|reservations?|sales|admin|office|accounts?|reception|enquiries|contact|events|manager|support)@)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i },
];

export function findPersonalData(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.label);
}

export function personalDataError(text: string): string | null {
  const found = findPersonalData(text);
  if (!found.length) return null;
  return `This looks like it contains ${found.join(" and ")}. Keep notes business-level: use roles ("spoke to the GM") and the business line, not personal details.`;
}

// Generic inbox check for the company email field.
export function isGenericInbox(email: string): boolean {
  return findPersonalData(email).length === 0;
}
