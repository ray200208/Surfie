export interface SensitiveFieldDetails {
  type: string;
  autocomplete: string;
  name: string;
  id: string;
  label: string;
  placeholder: string;
  ariaLabel: string;
  webkitTextSecurity?: string;
}

const SENSITIVE_WORDS = /password|passcode|otp|one[\s_-]*time|verification[\s_-]*code|card[\s_-]*number|credit|debit|cvv|cvc|expir(y|ation)|aadhaar|aadhar|ssn|account[\s_-]*number|ifsc/i;
const AUTOCOMPLETE_SENSITIVE = /^(current-password|new-password|one-time-code|cc-)/i;

export function getSensitiveFieldReason(details: SensitiveFieldDetails): string | null {
  const type = details.type.toLowerCase();
  const autocomplete = details.autocomplete.trim().split(/\s+/);
  const descriptor = `${details.name} ${details.id} ${details.label} ${details.placeholder} ${details.ariaLabel}`;

  if (type === 'password' || type === 'hidden') return 'sensitive credential field';
  if (autocomplete.some((token) => AUTOCOMPLETE_SENSITIVE.test(token))) return 'sensitive credential field';
  if (SENSITIVE_WORDS.test(descriptor) || /\bpin\b/i.test(descriptor.replace(/\bpin[\s_-]*(?:code|number)\b/gi, ''))) {
    return 'sensitive field';
  }
  if (details.webkitTextSecurity && details.webkitTextSecurity !== 'none') return 'obscured text field';
  return null;
}

export function isOtpInputMetadata(
  maxLength: number,
  type: string,
  inputMode: string,
  pattern: string
): boolean {
  const normalizedType = type.toLowerCase();
  const numericHint = normalizedType === 'number' || normalizedType === 'tel' ||
    inputMode.toLowerCase() === 'numeric' || pattern.includes('0-9');
  return maxLength === 1 && numericHint;
}
