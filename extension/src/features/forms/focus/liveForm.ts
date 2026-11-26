import type { PersonaProfile } from '../../../shared/types';
import { isSensitiveField } from './plan';
import { scanPage } from './scanClient';
import type { FocusScanPageResponse, ScannedField } from './scanMessages';
import type { FocusField, FocusFieldInputType, FocusForm, FocusGroup, FocusVaultKey } from './types';

interface VaultKeywordRule {
  key: FocusVaultKey;
  keywords: string[];
}

const VAULT_KEYWORD_RULES: VaultKeywordRule[] = [
  { key: 'email', keywords: ['email', 'e mail'] },
  { key: 'phone', keywords: ['phone', 'mobile', 'telephone'] },
  { key: 'fullName', keywords: ['full name', 'name', 'first name', 'last name'] },
  { key: 'usn', keywords: ['usn', 'roll', 'student id', 'registration number'] },
  { key: 'institution', keywords: ['college', 'university', 'institution', 'school'] },
];
const PERSONA_FIELD_KEYS = new Set<FocusVaultKey>([
  'email', 'phone', 'fullName', 'usn', 'institution',
]);

const PERSONAL_GROUP_WORDS = ['name', 'dob', 'birth', 'birthday', 'gender', 'address', 'citizenship'];
const ACADEMIC_GROUP_WORDS = [
  'college', 'university', 'institution', 'school', 'student', 'usn', 'roll', 'course',
  'degree', 'program', 'gpa', 'grade', 'graduation',
];
const CONTACT_GROUP_WORDS = ['email', 'mail', 'phone', 'mobile', 'telephone', 'contact'];
const CONSENT_WORDS = /\b(agree|terms|consent|accept|privacy policy|i declare|i confirm|newsletter|marketing|subscribe)\b/i;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function hasKeyword(descriptor: string, keyword: string): boolean {
  const normalizedDescriptor = ` ${normalize(descriptor)} `;
  const normalizedKeyword = normalize(keyword);
  return normalizedDescriptor.includes(` ${normalizedKeyword} `);
}

function mapVaultKey(descriptor: string): { key?: FocusVaultKey; confidence: number } {
  const exactRule = VAULT_KEYWORD_RULES.find((rule) =>
    rule.keywords.some((keyword) => hasKeyword(descriptor, keyword))
  );
  if (exactRule && PERSONA_FIELD_KEYS.has(exactRule.key)) {
    return { key: exactRule.key, confidence: 0.9 };
  }

  const normalizedDescriptor = normalize(descriptor);
  const partialRule = VAULT_KEYWORD_RULES.find((rule) =>
    rule.keywords.some((keyword) => {
      const normalizedKeyword = normalize(keyword);
      return normalizedDescriptor
        .split(' ')
        .some((word) => word.length >= 3 && word !== normalizedKeyword && word.includes(normalizedKeyword));
    })
  );
  if (partialRule && PERSONA_FIELD_KEYS.has(partialRule.key)) {
    return { key: partialRule.key, confidence: 0.5 };
  }
  return { confidence: 0 };
}

function inputTypeFor(element: ScannedField): FocusFieldInputType {
  switch (element.kind) {
    case 'textarea': return 'textarea';
    case 'select': return 'select';
    case 'multiselect':
    case 'checkbox-group': return 'multiselect';
    case 'radio-group': return 'radio';
    case 'checkbox': return 'checkbox';
    case 'text':
      return ['email', 'tel', 'number', 'date'].includes(element.inputType)
        ? element.inputType as FocusFieldInputType
        : 'text';
  }
}

function keywordGroup(descriptor: string): { id: string; title: string } {
  if (CONTACT_GROUP_WORDS.some((word) => hasKeyword(descriptor, word))) {
    return { id: 'contact', title: 'Contact' };
  }
  if (ACADEMIC_GROUP_WORDS.some((word) => hasKeyword(descriptor, word))) {
    return { id: 'academic', title: 'Academic' };
  }
  if (PERSONAL_GROUP_WORDS.some((word) => hasKeyword(descriptor, word))) {
    return { id: 'personal', title: 'Personal' };
  }
  return { id: 'other', title: 'Other' };
}

function groupFor(element: ScannedField): FocusGroup {
  const title = element.groupHint.trim();
  if (!title) return { ...keywordGroup(`${element.label} ${element.name} ${element.placeholder}`), fieldIds: [] };
  const id = `section-${normalize(title).replace(/\s+/g, '-') || 'form'}`;
  return { id, title, fieldIds: [] };
}

function buildAdapterResult(elements: ScannedField[], _persona: PersonaProfile): {
  form: FocusForm;
  excluded: { label: string; reason: string }[];
} {
  const fields: FocusField[] = [];
  const groups = new Map<string, FocusGroup>();
  const excluded: { label: string; reason: string }[] = [];

  elements.forEach((element, index) => {
    const inputType = inputTypeFor(element);
    const group = groupFor(element);
    const descriptor = `${element.label} ${element.name} ${element.placeholder} ${element.groupHint}`;
    const vaultMapping = mapVaultKey(descriptor);
    const field: FocusField = {
      id: element.id || `live-field-${index}`,
      label: element.label || element.name || 'Form field',
      inputType,
      required: element.required,
      groupId: group.id,
      ...(vaultMapping.key ? { vaultKey: vaultMapping.key } : {}),
      ...(element.options.length ? { options: element.options.map((option) => ({ ...option })) } : {}),
      ...(inputType === 'checkbox' || inputType === 'multiselect'
        ? { consent: CONSENT_WORDS.test(descriptor) }
        : {}),
      value: '',
      source: null,
      confidence: vaultMapping.confidence,
      selector: element.selector,
    };

    if (isSensitiveField(field)) {
      excluded.push({ label: field.label, reason: 'sensitive field' });
      return;
    }
    fields.push(field);
    const existing = groups.get(group.id);
    if (existing) existing.fieldIds.push(field.id);
    else groups.set(group.id, { ...group, fieldIds: [field.id] });
  });

  return {
    form: { id: 'live-page-form', title: 'Page form', fields, groups: Array.from(groups.values()) },
    excluded,
  };
}

export function toFocusForm(elements: ScannedField[], persona: PersonaProfile): FocusForm {
  return buildAdapterResult(elements, persona).form;
}

export interface LiveFormScanResult {
  ok: boolean;
  form: FocusForm | null;
  excluded: FocusScanPageResponse['excluded'];
  stats: FocusScanPageResponse['stats'];
  pageTitle: string;
  reason?: string;
}

const EMPTY_PERSONA: PersonaProfile = {
  id: 'personal', label: 'Local Persona', fullName: '', email: '', phone: '',
};

export async function scanActivePageForm(persona: PersonaProfile = EMPTY_PERSONA): Promise<LiveFormScanResult> {
  const scan = await scanPage();
  if (!scan.ok) {
    return {
      ok: false,
      form: null,
      excluded: scan.excluded,
      stats: scan.stats,
      pageTitle: scan.pageTitle,
      reason: scan.reason ?? 'This page could not be scanned. Open a regular webpage and try again.',
    };
  }

  const adapted = buildAdapterResult(scan.elements, persona);
  const excluded = [...scan.excluded, ...adapted.excluded];
  if (adapted.form.fields.length === 0) {
    return {
      ok: false,
      form: null,
      excluded,
      stats: scan.stats,
      pageTitle: scan.pageTitle,
      reason: 'No usable form fields were found on this page.',
    };
  }

  return {
    ok: true,
    form: adapted.form,
    excluded,
    stats: scan.stats,
    pageTitle: scan.pageTitle,
  };
}
