import { isSensitiveField } from './plan';
import { sendToActiveTab } from './tabMessaging';
import type { FocusFillFieldsResponse } from './fillMessages';
import type { FocusForm, FocusField } from './types';
import type { ScannedFieldKind } from './scanMessages';

export interface SkippedConfirmedField {
  fieldId: string;
  label: string;
  reason: string;
}

export interface FillConfirmedResult {
  ok: boolean;
  filledCount: number;
  skippedFields: SkippedConfirmedField[];
  failedFields: string[];
  reason?: string;
}

interface PendingFill {
  fieldId: string;
  label: string;
  selector: string;
  kind: ScannedFieldKind;
  value: string;
  optionSelectors: Record<string, string>;
}

function fillKind(field: FocusField): ScannedFieldKind {
  if (field.inputType === 'textarea') return 'textarea';
  if (field.inputType === 'select') return 'select';
  if (field.inputType === 'checkbox') return 'checkbox';
  if (field.inputType === 'radio') return 'radio-group';
  if (field.inputType === 'multiselect') {
    return field.selector?.includes(',') ? 'checkbox-group' : 'multiselect';
  }
  return 'text';
}

function optionSelectorsFor(field: FocusField): Record<string, string> {
  return Object.fromEntries(
    (field.options ?? [])
      .filter((option): option is typeof option & { selector: string } => Boolean(option.selector))
      .map((option) => [option.value, option.selector])
  );
}

export async function fillConfirmedFields(
  values: Record<string, string>,
  form: FocusForm
): Promise<FillConfirmedResult> {
  const skippedFields: SkippedConfirmedField[] = [];
  const pending: PendingFill[] = [];
  const fieldsById = new Map(form.fields.map((field) => [field.id, field]));

  for (const [fieldId, value] of Object.entries(values)) {
    const field = fieldsById.get(fieldId);
    if (!field) {
      skippedFields.push({ fieldId, label: fieldId, reason: 'Field was not found in the scanned form.' });
      continue;
    }
    if (isSensitiveField(field)) {
      skippedFields.push({ fieldId, label: field.label, reason: 'Sensitive fields are never filled.' });
      continue;
    }
    if (!value.trim()) {
      skippedFields.push({ fieldId, label: field.label, reason: 'Empty values are not sent.' });
      continue;
    }
    if (!field.selector) {
      skippedFields.push({ fieldId, label: field.label, reason: 'No page selector is available.' });
      continue;
    }
    pending.push({
      fieldId,
      label: field.label,
      selector: field.selector,
      kind: fillKind(field),
      value,
      optionSelectors: optionSelectorsFor(field),
    });
  }

  if (pending.length === 0) {
    return { ok: skippedFields.length === 0, filledCount: 0, skippedFields, failedFields: [] };
  }

  const fallback: FocusFillFieldsResponse = {
    filled: [],
    skipped: pending.map((field) => ({ selector: field.selector, reason: 'Could not reach the page safely.' })),
  };
  try {
    const response = await sendToActiveTab(
      {
        type: 'FOCUS_FILL_FIELDS' as const,
        items: pending.map(({ selector, kind, value, optionSelectors }) => ({
          selector, kind, value, optionSelectors,
        })),
      },
      fallback
    );
    const filledSelectors = new Set(response.filled);
    const fieldBySelector = new Map(pending.map((field) => [field.selector, field]));
    response.skipped.forEach((skipped) => {
      const field = fieldBySelector.get(skipped.selector);
      skippedFields.push({
        fieldId: field?.fieldId ?? skipped.selector,
        label: field?.label ?? skipped.selector,
        reason: skipped.reason,
      });
    });
    const failedFields = pending
      .filter((field) => !filledSelectors.has(field.selector))
      .filter((field) => !response.skipped.some((skipped) => skipped.selector === field.selector))
      .map((field) => field.label);

    return {
      ok: skippedFields.length === 0 && failedFields.length === 0,
      filledCount: response.filled.length,
      skippedFields,
      failedFields,
    };
  } catch (error) {
    return {
      ok: false,
      filledCount: 0,
      skippedFields,
      failedFields: pending.map((field) => field.label),
      reason: error instanceof Error ? error.message : 'Could not fill the confirmed fields.',
    };
  }
}
