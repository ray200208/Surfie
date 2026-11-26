import type { LanguageCode } from '../../../shared/types';

export const SHORT_FORM_MAX_FIELDS = 5;
export const CARD_GROUP_MIN_FIELDS = 3;
export const CARD_GROUP_MAX_FIELDS = 6;
export const AUTO_FILL_MIN_CONFIDENCE = 0.8;

export const FOCUS_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'EN', label: 'English' },
  { code: 'HI', label: 'Hindi' },
  { code: 'TA', label: 'Tamil' },
];
