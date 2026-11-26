import { sendToActiveTab } from '../../../shared/messages';
import { isSensitiveField } from './plan';
import type { FocusForm } from './types';

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
  value: string;
}

export async function fillConfirmedFields(
  values: Record<string, string>,
  form: FocusForm
): Promise<FillConfirmedResult> {
  const skippedFields: SkippedConfirmedField[] = [];
  const pending: PendingFill[] = [];

  try {
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
      pending.push({ fieldId, label: field.label, selector: field.selector, value });
    }

    if (pending.length === 0) {
      return {
        ok: skippedFields.length === 0,
        filledCount: 0,
        skippedFields,
        failedFields: [],
      };
    }

    const response = await sendToActiveTab({
      type: 'FILL_SAFE_FIELDS',
      payload: {
        fields: pending.map(({ selector, value }) => ({ selector, value })),
      },
    });
    const missingSelectors = new Set(response.missingSelectors);
    const failedFields = pending
      .filter((field) => missingSelectors.has(field.selector))
      .map((field) => field.label);

    if (response.skippedSensitiveCount > 0) {
      failedFields.push('A page field was flagged as sensitive and skipped.');
    }

    const unaccountedCount =
      pending.length - response.filledCount - failedFields.filter((label) =>
        pending.some((field) => field.label === label)
      ).length;
    if (unaccountedCount > 0) {
      const alreadyFailed = new Set(failedFields);
      const unaccounted = pending
        .filter((field) => !missingSelectors.has(field.selector) && !alreadyFailed.has(field.label))
        .slice(-unaccountedCount)
        .map((field) => field.label);
      failedFields.push(...unaccounted);
    }

    return {
      ok: skippedFields.length === 0 && failedFields.length === 0,
      filledCount: response.filledCount,
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
