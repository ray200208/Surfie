import type { KeyboardEvent } from 'react';
import { parseMulti, serializeMulti } from './plan';
import type { FocusField as FocusFieldModel } from './types';
import SourceBadge from './SourceBadge';

interface FocusFieldProps {
  field: FocusFieldModel;
  onChange: (value: string) => void;
  onEnter?: () => void;
}

const CONTROL_CLASS =
  'w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#1E1B4B] shadow-xs outline-none transition focus:border-[#331E6D] focus:ring-2 focus:ring-[#331E6D]/20';
const CHOICE_CLASS =
  'h-4 w-4 rounded border-[#CBD5E1] text-[#331E6D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/30';

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

function RequiredMarker({ required }: { required: boolean }) {
  return required ? (
    <>
      <span aria-hidden="true" className="ml-1 text-[#D9433B]">*</span>
      <span className="sr-only"> required</span>
    </>
  ) : null;
}

export default function FocusField({ field, onChange, onEnter }: FocusFieldProps) {
  const inputId = `focus-field-${field.id}`;
  const options = field.options ?? [];
  const selectedValues = new Set(parseMulti(field.value));
  const selectOptions = field.inputType === 'select' ? options : [];
  const matchingOption = selectOptions.find(
    (option) =>
      normalized(option.value) === normalized(field.value) ||
      normalized(option.label) === normalized(field.value)
  );
  const hasUnmatchedValue = field.value !== '' && !matchingOption;
  const selectedValue = hasUnmatchedValue ? field.value : matchingOption?.value ?? field.value;

  let control;
  if (field.inputType === 'checkbox') {
    control = (
      <div className="flex items-start gap-2">
        <input
          id={inputId}
          name={field.id}
          type="checkbox"
          checked={field.value === 'true'}
          required={field.required}
          aria-invalid={field.required && field.value !== 'true'}
          onChange={(event) => onChange(event.target.checked ? 'true' : '')}
          onKeyDown={(event) => handleEnter(event, onEnter)}
          className={`${CHOICE_CLASS} mt-0.5 shrink-0`}
        />
        <label htmlFor={inputId} className="text-xs leading-relaxed text-[#475569]">
          {field.label}<RequiredMarker required={field.required} />
        </label>
      </div>
    );
  } else if (field.inputType === 'radio' && options.length > 0) {
    control = (
      <fieldset className="space-y-2" aria-required={field.required}>
        <legend className="text-xs font-semibold text-[#1E1B4B]">
          {field.label}<RequiredMarker required={field.required} />
        </legend>
        {options.map((option, index) => {
          const optionId = `${inputId}-${index}`;
          return (
            <label key={`${option.value}-${index}`} htmlFor={optionId} className="flex items-start gap-2 text-xs text-[#475569]">
              <input
                id={optionId}
                name={field.id}
                type="radio"
                value={option.value}
                checked={field.value === option.value}
                required={field.required}
                onChange={(event) => { if (event.target.checked) onChange(option.value); }}
                onKeyDown={(event) => handleEnter(event, index === options.length - 1 ? onEnter : undefined)}
                className={`${CHOICE_CLASS} mt-0.5 shrink-0`}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </fieldset>
    );
  } else if (field.inputType === 'multiselect' && options.length > 0) {
    control = (
      <fieldset className="space-y-2" aria-required={field.required}>
        <legend className="text-xs font-semibold text-[#1E1B4B]">
          {field.label}<RequiredMarker required={field.required} />
        </legend>
        {options.map((option, index) => {
          const optionId = `${inputId}-${index}`;
          return (
            <label key={`${option.value}-${index}`} htmlFor={optionId} className="flex items-start gap-2 text-xs text-[#475569]">
              <input
                id={optionId}
                name={field.id}
                type="checkbox"
                value={option.value}
                checked={selectedValues.has(option.value)}
                onChange={(event) => {
                  const nextValues = new Set(selectedValues);
                  if (event.target.checked) nextValues.add(option.value);
                  else nextValues.delete(option.value);
                  onChange(serializeMulti(Array.from(nextValues)));
                }}
                onKeyDown={(event) => handleEnter(event, index === options.length - 1 ? onEnter : undefined)}
                className={`${CHOICE_CLASS} mt-0.5 shrink-0`}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </fieldset>
    );
  } else if (field.inputType === 'textarea') {
    control = (
      <textarea
        id={inputId}
        name={field.id}
        rows={3}
        value={field.value}
        required={field.required}
        aria-invalid={field.required && field.value.trim() === ''}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => handleEnter(event, onEnter)}
        className={`${CONTROL_CLASS} min-h-20 resize-y`}
      />
    );
  } else if (field.inputType === 'select' && selectOptions.length > 0) {
    control = (
      <select
        id={inputId}
        name={field.id}
        value={selectedValue}
        required={field.required}
        aria-invalid={field.required && field.value.trim() === ''}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => handleEnter(event, onEnter)}
        className={CONTROL_CLASS}
      >
        <option value="" disabled>Select an option</option>
        {hasUnmatchedValue && <option value={field.value}>{field.value}</option>}
        {selectOptions.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  } else {
    const inputType = field.inputType === 'select' ? 'text' : field.inputType;
    control = (
      <input
        id={inputId}
        name={field.id}
        type={inputType === 'radio' || inputType === 'multiselect' ? 'text' : inputType}
        value={field.value}
        required={field.required}
        aria-invalid={field.required && field.value.trim() === ''}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => handleEnter(event, onEnter)}
        className={CONTROL_CLASS}
      />
    );
  }

  const groupInput = (field.inputType === 'radio' || field.inputType === 'multiselect') && options.length > 0;
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        {groupInput || field.inputType === 'checkbox' ? (
          <span className="sr-only">{field.label}</span>
        ) : (
          <label htmlFor={inputId} className="text-xs font-semibold text-[#1E1B4B]">
            {field.label}<RequiredMarker required={field.required} />
          </label>
        )}
        {field.source && <SourceBadge source={field.source} />}
      </div>
      {control}
      {field.consent && (
        <p className="text-[10px] font-medium text-[#D97706]">You must tick this yourself.</p>
      )}
    </div>
  );
}
