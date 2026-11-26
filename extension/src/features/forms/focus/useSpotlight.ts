import { useEffect } from 'react';
import { clearSpotlight, showSpotlight } from './spotlightClient';
import type { FocusField, FocusForm } from './types';

export function useSpotlight(activeFieldIds: string[], form: FocusForm): void {
  const fieldsById = new Map(form.fields.map((field) => [field.id, field]));
  const activeFields = activeFieldIds
    .map((fieldId) => fieldsById.get(fieldId))
    .filter((field): field is FocusField => Boolean(field?.selector));
  const selectors = activeFields.flatMap((field) =>
    (field.selector as string).split(',').map((selector) => selector.trim()).filter(Boolean)
  );
  const signature = JSON.stringify(selectors);
  const label =
    activeFields.length === 1
      ? activeFields[0].label
      : activeFields.length > 1
        ? `${activeFields.length} fields`
        : undefined;

  useEffect(() => {
    if (selectors.length > 0) {
      void showSpotlight(selectors, label);
    } else {
      void clearSpotlight();
    }
    return () => {
      void clearSpotlight();
    };
  }, [signature, label]);
}
