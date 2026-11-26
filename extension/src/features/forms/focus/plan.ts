import type { PersonaProfile } from '../../../shared/types';
import {
  AUTO_FILL_MIN_CONFIDENCE,
  CARD_GROUP_MAX_FIELDS,
  CARD_GROUP_MIN_FIELDS,
  SHORT_FORM_MAX_FIELDS,
} from './constants';
import type {
  FocusField,
  FocusForm,
  FocusFieldSource,
  FocusMode,
  FocusPlan,
  FocusStep,
  ReviewItem,
} from './types';

function isEmpty(value: string): boolean {
  return value.trim().length === 0;
}

export function chooseMode(form: FocusForm): FocusMode {
  return form.fields.length <= SHORT_FORM_MAX_FIELDS ? 'spotlight-only' : 'cards';
}

export function autoFillFromVault(form: FocusForm, persona: PersonaProfile): FocusForm {
  let changed = false;
  const fields = form.fields.map((field) => {
    if (!field.vaultKey || !(field.confidence >= AUTO_FILL_MIN_CONFIDENCE)) return field;

    const value = persona[field.vaultKey];
    if (typeof value !== 'string' || isEmpty(value)) return field;

    if (field.inputType === 'select' && field.options?.length) {
      const normalizedValue = value.trim().toLowerCase();
      const matchingOption = field.options.find(
        (option) =>
          option.value.trim().toLowerCase() === normalizedValue ||
          option.label.trim().toLowerCase() === normalizedValue
      );
      if (!matchingOption) return field;
    }

    changed = true;
    return { ...field, value, source: 'vault' as const };
  });

  return changed ? { ...form, fields } : form;
}

interface GroupChunk {
  title: string;
  fieldIds: string[];
}

function chunkGroup(title: string, fieldIds: string[]): GroupChunk[] {
  if (fieldIds.length <= CARD_GROUP_MAX_FIELDS) return [{ title, fieldIds }];

  const chunkCount = Math.ceil(fieldIds.length / CARD_GROUP_MAX_FIELDS);
  const chunks: GroupChunk[] = [];
  for (let offset = 0; offset < fieldIds.length; offset += CARD_GROUP_MAX_FIELDS) {
    const chunkNumber = chunks.length + 1;
    chunks.push({
      title: `${title} (${chunkNumber} of ${chunkCount})`,
      fieldIds: fieldIds.slice(offset, offset + CARD_GROUP_MAX_FIELDS),
    });
  }
  return chunks;
}

function mergeTitles(first: string, second: string): string {
  return `${first} and ${second}`;
}

function combineSmallGroups(steps: GroupChunk[]): GroupChunk[] {
  const combined: GroupChunk[] = [];
  let index = 0;

  while (index < steps.length) {
    const current = steps[index];
    const next = steps[index + 1];

    if (
      current.fieldIds.length < CARD_GROUP_MIN_FIELDS &&
      next &&
      current.fieldIds.length + next.fieldIds.length <= CARD_GROUP_MAX_FIELDS
    ) {
      combined.push({
        title: mergeTitles(current.title, next.title),
        fieldIds: [...current.fieldIds, ...next.fieldIds],
      });
      index += 2;
      continue;
    }

    if (current.fieldIds.length < CARD_GROUP_MIN_FIELDS && !next && combined.length > 0) {
      const previous = combined[combined.length - 1];
      if (previous.fieldIds.length + current.fieldIds.length <= CARD_GROUP_MAX_FIELDS) {
        combined[combined.length - 1] = {
          title: mergeTitles(previous.title, current.title),
          fieldIds: [...previous.fieldIds, ...current.fieldIds],
        };
        index += 1;
        continue;
      }
    }

    combined.push(current);
    index += 1;
  }

  return combined;
}

function buildCardSteps(form: FocusForm, gapFieldIds: Set<string>): FocusStep[] {
  const fieldsById = new Map(form.fields.map((field) => [field.id, field]));
  const groupSteps = form.groups.flatMap((group) => {
    const gapIds = group.fieldIds.filter((id) => gapFieldIds.has(id) && fieldsById.has(id));
    if (gapIds.length === 0) return [];
    return chunkGroup(group.title, gapIds);
  });

  return combineSmallGroups(groupSteps).map((group) => ({
    kind: 'group',
    title: group.title,
    fieldIds: group.fieldIds,
  }));
}

export function buildPlan(form: FocusForm, modeOverride?: FocusMode): FocusPlan {
  const mode = modeOverride ?? chooseMode(form);
  const autoFilledFieldIds = form.fields
    .filter((field) => field.source === 'vault')
    .map((field) => field.id);
  const gapFields = form.fields.filter(
    (field) => field.source !== 'vault' && (isEmpty(field.value) || field.source === null)
  );
  const gapFieldIds = gapFields.map((field) => field.id);
  const gapFieldIdSet = new Set(gapFieldIds);
  const reviewStep: FocusStep = {
    kind: 'review',
    title: 'Review',
    fieldIds: form.fields.map((field) => field.id),
  };

  const steps =
    mode === 'spotlight-only'
      ? gapFields.map((field): FocusStep => ({
          kind: 'field',
          title: field.label,
          fieldIds: [field.id],
        }))
      : buildCardSteps(form, gapFieldIdSet);

  return {
    mode,
    autoFilledFieldIds,
    gapFieldIds,
    steps: [...steps, reviewStep],
  };
}

const SENSITIVE_FIELD_PATTERN =
  /password|passcode|\bpin(?:[\s_-]*(?:code|number))?\b|otp|one[\s_-]*time|verification[\s_-]*code|card|credit|debit|cvv|cvc|expir(y|ation)|aadhaar|aadhar|ssn|account[\s_-]*number|ifsc/i;

export function isSensitiveField(field: FocusField): boolean {
  return SENSITIVE_FIELD_PATTERN.test(`${field.inputType} ${field.label} ${field.id}`);
}

export function buildReviewItems(form: FocusForm): ReviewItem[] {
  return form.fields.map((field: FocusField) => {
    const sensitive = isSensitiveField(field);
    const matchingOption =
      field.inputType === 'select'
        ? field.options?.find((option) => option.value === field.value)
        : undefined;

    return {
      fieldId: field.id,
      label: field.label,
      inputType: field.inputType,
      ...(field.options ? { options: field.options.map((option) => ({ ...option })) } : {}),
      value: sensitive ? '' : field.value,
      displayValue: sensitive
        ? 'Hidden (you type this yourself)'
        : matchingOption?.label ?? field.value,
      source: field.source,
      required: field.required,
      missing: !sensitive && field.required && isEmpty(field.value),
      sensitive,
    };
  });
}

export function canSubmit(items: ReviewItem[]): boolean {
  return items.every((item) => item.sensitive || !item.missing);
}

export function getConfirmableValues(form: FocusForm): Record<string, string> {
  return Object.fromEntries(
    form.fields
      .filter((field) => !isSensitiveField(field) && !isEmpty(field.value))
      .map((field) => [field.id, field.value])
  );
}

export function applyFieldValue(
  form: FocusForm,
  fieldId: string,
  value: string,
  source: FocusFieldSource
): FocusForm {
  const fieldIndex = form.fields.findIndex((field) => field.id === fieldId);
  if (fieldIndex === -1) return form;

  const fields = form.fields.map((field, index) =>
    index === fieldIndex ? { ...field, value, source } : field
  );
  return { ...form, fields };
}
