/**
 * Normalizes a phone number typed by a user to E.164 ("+972501234567").
 * Local Israeli numbers ("050-1234567") get the +972 prefix; Israeli numbers
 * must be mobile (05X), since sign-in codes go to a phone.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.trim().replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;

  if (!/^\d{8,15}$/.test(digits)) return null;
  if (digits.startsWith("972") && !/^9725\d{8}$/.test(digits)) return null;
  return `+${digits}`;
}

/** "+972501234567" -> "050-1234567" for display. */
export function formatPhone(phone: string): string {
  const match = phone.match(/^\+9725(\d)(\d{7})$/);
  return match ? `05${match[1]}-${match[2]}` : phone;
}
