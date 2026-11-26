import { sendToActiveTab } from '../../../shared/messages';
import type { PersonaProfile, VisibleDomElement } from '../../../shared/types';
import { isSensitiveField } from './plan';
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

function inputTypeFor(element: VisibleDomElement): FocusFieldInputType | null {
  if (element.tag === 'select') return 'select';
  if (element.tag === 'textarea') return 'textarea';
  if (element.tag !== 'input') return null;

  const type = (element.type || 'text').toLowerCase();
  if (type === 'password' || type === 'hidden') return null;
  if (type === 'text' || type === 'email' || type === 'tel' || type === 'number' || type === 'date') {
    return type;
  }
  if (type === 'search' || type === 'url') return 'text';
  return null;
}

function groupIdFor(descriptor: string): FocusGroup['id'] {
  if (CONTACT_GROUP_WORDS.some((word) => hasKeyword(descriptor, word))) return 'contact';
  if (ACADEMIC_GROUP_WORDS.some((word) => hasKeyword(descriptor, word))) return 'academic';
  if (PERSONAL_GROUP_WORDS.some((word) => hasKeyword(descriptor, word))) return 'personal';
  return 'other';
}

function isExcluded(element: VisibleDomElement, inputType: FocusFieldInputType): boolean {
  const rawType = element.type.toLowerCase();
  if (element.isSensitive || rawType === 'password' || rawType === 'hidden') return true;

  // Raw autocomplete hints are not part of VisibleDomElement; fail-closed keyword matching is the known limitation.
  const candidate: FocusField = {
    id: `${element.selector} ${element.name}`,
    label: `${rawType} ${element.label} ${element.name} ${element.placeholder}`,
    inputType,
    required: false,
    groupId: 'other',
    value: '',
    source: null,
    confidence: 0,
  };
  return isSensitiveField(candidate);
}

export function toFocusForm(elements: VisibleDomElement[], _persona: PersonaProfile): FocusForm {
  const fields: FocusField[] = [];

  elements.forEach((element, index) => {
    const inputType = inputTypeFor(element);
    if (!inputType || isExcluded(element, inputType)) return;

    const descriptor = `${element.label} ${element.name} ${element.placeholder}`;
    const vaultMapping = mapVaultKey(descriptor);
    fields.push({
      id: `live-field-${index}`,
      label: element.label || element.name || 'Form field',
      inputType,
      // VisibleDomElement has no required flag; default to false rather than infer it from copy.
      required: false,
      groupId: groupIdFor(descriptor),
      ...(vaultMapping.key ? { vaultKey: vaultMapping.key } : {}),
      value: '',
      source: null,
      confidence: vaultMapping.confidence,
      selector: element.selector,
    });
  });

  const groupDefinitions: { id: FocusGroup['id']; title: string }[] = [
    { id: 'personal', title: 'Personal' },
    { id: 'academic', title: 'Academic' },
    { id: 'contact', title: 'Contact' },
    { id: 'other', title: 'Other' },
  ];
  const groups = groupDefinitions
    .map(({ id, title }) => ({
      id,
      title,
      fieldIds: fields.filter((field) => field.groupId === id).map((field) => field.id),
    }))
    .filter((group) => group.fieldIds.length > 0);

  return { id: 'live-page-form', title: 'Page form', fields, groups };
}

export async function scanActivePageForm(): Promise<{
  ok: boolean;
  form: FocusForm | null;
  reason?: string;
}> {
  try {
    const response = await sendToActiveTab({ type: 'EXTRACT_VISIBLE_DOM' });
    const persona: PersonaProfile = {
      id: 'personal',
      label: 'Local scan placeholder',
      fullName: '',
      email: '',
      phone: '',
      institution: '',
      usn: '',
    };
    const form = toFocusForm(response.elements, persona);
    if (form.fields.length === 0) {
      return {
        ok: false,
        form: null,
        reason: 'No usable form fields were found on this page. Try a page with a form.',
      };
    }
    return { ok: true, form };
  } catch (error) {
    return {
      ok: false,
      form: null,
      reason: error instanceof Error ? error.message : 'Could not scan this page. Please try again.',
    };
  }
}
