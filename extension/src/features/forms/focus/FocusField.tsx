import type { KeyboardEvent } from 'react';
import type { FocusField as FocusFieldModel } from './types';
import SourceBadge from './SourceBadge';

interface FocusFieldProps {
  field: FocusFieldModel;
  onChange: (value: string) => void;
  onEnter?: () => void;
}

const CONTROL_CLASS =
  'w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#1E1B4B] shadow-xs outline-none transition focus:border-[#331E6D] focus:ring-2 focus:ring-[#331E6D]/20';

function handleEnter(event: KeyboardEvent<HTMLElement>, onEnter?: () => void): void {
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    onEnter
  ) {
    event.preventDefault();
    onEnter();
  }
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export default function FocusField({ field, onChange, onEnter }: FocusFieldProps) {
  const inputId = `focus-field-${field.id}`;
  const options = field.inputType === 'select' ? field.options : undefined;
  const hasOptions = Boolean(options?.length);
  const matchingOption = options?.find(
    (option) =>
      normalized(option.value) === normalized(field.value) ||
      normalized(option.label) === normalized(field.value)
  );
  const hasUnmatchedValue = field.value !== '' && !matchingOption;
  const selectedValue = hasUnmatchedValue
    ? field.value
    : matchingOption?.value ?? field.value;

  let control;
  if (field.inputType === 'textarea') {
    control = (
      <textarea
        id={inputId}
        name={field.id}
        rows={3}
        value={field.value}
        required={field.required}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => handleEnter(event, onEnter)}
        className={`${CONTROL_CLASS} min-h-20 resize-y`}
      />
    );
  } else if (field.inputType === 'select' && hasOptions) {
    control = (
      <select
        id={inputId}
        name={field.id}
        value={selectedValue}
        required={field.required}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => handleEnter(event, onEnter)}
        className={CONTROL_CLASS}
      >
        <option value="" disabled>
          Select an option
        </option>
        {hasUnmatchedValue && <option value={field.value}>{field.value}</option>}
        {options?.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    const inputType = field.inputType === 'select' ? 'text' : field.inputType;
    control = (
      <input
        id={inputId}
        name={field.id}
        type={inputType}
        value={field.value}
        required={field.required}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => handleEnter(event, onEnter)}
        className={CONTROL_CLASS}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-semibold text-[#1E1B4B]">
          {field.label}
          {field.required && (
            <>
              <span aria-hidden="true" className="ml-1 text-[#D9433B]">*</span>
              <span className="sr-only"> required</span>
            </>
          )}
        </label>
        {field.source && <SourceBadge source={field.source} />}
      </div>
      {control}
    </div>
  );
}
