import { useCallback, useEffect, useRef, useState } from 'react';
import { applyFieldValue, buildPlan } from './plan';
import type { FocusForm, FocusMode, FocusStep } from './types';
import FocusField from './FocusField';

export interface FocusPanelProps {
  form: FocusForm;
  onFormChange?: (form: FocusForm) => void;
  onActiveFieldsChange?: (fieldIds: string[]) => void;
  onExit?: () => void;
  onConfirm?: (form: FocusForm) => void;
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export default function FocusPanel({
  form,
  onFormChange,
  onActiveFieldsChange,
  onExit,
  onConfirm,
}: FocusPanelProps) {
  const [localForm, setLocalForm] = useState(form);
  const [plan, setPlan] = useState(() => buildPlan(form));
  const [mode, setMode] = useState<FocusMode>(() => buildPlan(form).mode);
  const [stepIndex, setStepIndex] = useState(0);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const propFormRef = useRef(form);
  const lastEmittedFormRef = useRef<FocusForm | null>(null);

  useEffect(() => {
    if (form === lastEmittedFormRef.current) {
      propFormRef.current = form;
      lastEmittedFormRef.current = null;
      return;
    }
    if (form === propFormRef.current) return;

    propFormRef.current = form;
    const nextPlan = buildPlan(form, mode);
    setLocalForm(form);
    setPlan(nextPlan);
    setStepIndex(0);
  }, [form, mode]);

  const currentStep: FocusStep = plan.steps[
    Math.min(stepIndex, Math.max(0, plan.steps.length - 1))
  ] ?? { kind: 'review', title: 'Review', fieldIds: localForm.fields.map((field) => field.id) };
  const fieldsById = new Map(localForm.fields.map((field) => [field.id, field]));
  const stepFields = currentStep.fieldIds
    .map((fieldId) => fieldsById.get(fieldId))
    .filter((field): field is NonNullable<typeof field> => field !== undefined);
  const stepKey = `${stepIndex}:${currentStep.kind}:${currentStep.title}:${currentStep.fieldIds.join(',')}`;
  const autoFilledCount = plan.autoFilledFieldIds.length;
  const isLastStep = stepIndex >= plan.steps.length - 1;
  const requiredFieldsComplete = stepFields
    .filter((field) => field.required)
    .every((field) => !isBlank(field.value));
  const canSkip =
    currentStep.kind !== 'review' &&
    stepFields.length > 0 &&
    stepFields.every((field) => !field.required);
  const progress = plan.steps.length === 0 ? 100 : ((stepIndex + 1) / plan.steps.length) * 100;

  const handleStepChange = useCallback(
    (nextIndex: number) => {
      setStepIndex(Math.max(0, Math.min(nextIndex, plan.steps.length - 1)));
    },
    [plan.steps.length]
  );

  const advance = useCallback(() => {
    if (!requiredFieldsComplete) return;
    if (isLastStep) {
      onConfirm?.(localForm);
      return;
    }
    handleStepChange(stepIndex + 1);
  }, [handleStepChange, isLastStep, localForm, onConfirm, requiredFieldsComplete, stepIndex]);

  const collapseToOriginal = useCallback(() => {
    setShowingOriginal(true);
    onActiveFieldsChange?.([]);
  }, [onActiveFieldsChange]);

  useEffect(() => {
    if (showingOriginal) return;
    headingRef.current?.focus();
    onActiveFieldsChange?.(currentStep.fieldIds);
  }, [showingOriginal, stepKey, onActiveFieldsChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showingOriginal) {
        event.preventDefault();
        collapseToOriginal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [collapseToOriginal, showingOriginal]);

  const updateField = (fieldId: string, value: string) => {
    const nextForm = applyFieldValue(localForm, fieldId, value, 'user');
    if (nextForm === localForm) return;
    setLocalForm(nextForm);
    if (onFormChange) {
      lastEmittedFormRef.current = nextForm;
      onFormChange(nextForm);
    }
  };

  const changeMode = (nextMode: FocusMode) => {
    if (nextMode === mode) return;
    const nextPlan = buildPlan(localForm, nextMode);
    setMode(nextMode);
    setPlan(nextPlan);
    setStepIndex(0);
  };

  if (showingOriginal) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-xs">
        <span className="text-xs font-semibold text-[#475569]">Viewing the original page</span>
        <button
          type="button"
          onClick={() => setShowingOriginal(false)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-[#331E6D] transition hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40"
        >
          Return to Focus Mode
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-3.5 rounded-xl bg-[#F8F9FC] text-[#1E1B4B]">
      <header className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#331E6D]">Focus Mode</p>
            <h2 className="mt-0.5 truncate text-sm font-bold text-[#1E1B4B]">{localForm.title}</h2>
          </div>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="shrink-0 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#475569] transition hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40"
            >
              Exit
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span aria-live="polite" className="text-[11px] font-semibold text-[#475569]">
            Step {stepIndex + 1} of {plan.steps.length}
          </span>
          <div className="inline-flex rounded-lg bg-[#F1F5F9] p-0.5" aria-label="Focus mode layout">
            {([
              ['cards', 'Cards'],
              ['spotlight-only', 'Spotlight'],
            ] as const).map(([modeId, label]) => (
              <button
                key={modeId}
                type="button"
                aria-pressed={mode === modeId}
                onClick={() => changeMode(modeId)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40 ${
                  mode === modeId
                    ? 'bg-white text-[#331E6D] shadow-xs'
                    : 'text-[#475569] hover:text-[#1E1B4B]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]"
          role="progressbar"
          aria-label="Focus Mode progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="h-full rounded-full bg-[#331E6D] transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium text-[#475569]">
            {autoFilledCount} {autoFilledCount === 1 ? 'field' : 'fields'} auto-filled from your vault
          </p>
          <button
            type="button"
            onClick={collapseToOriginal}
            className="text-[10px] font-bold text-[#331E6D] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40"
          >
            View original
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
        <h3 ref={headingRef} tabIndex={-1} className="text-sm font-bold text-[#1E1B4B] focus:outline-none">
          {currentStep.kind === 'review' ? 'Review step' : currentStep.title}
        </h3>
        {currentStep.kind === 'review' ? (
          <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8F9FC] p-3 text-xs text-[#475569]">
            Review step
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {stepFields.map((field, index) => (
              <FocusField
                key={field.id}
                field={field}
                onChange={(value) => updateField(field.id, value)}
                onEnter={index === stepFields.length - 1 && requiredFieldsComplete ? advance : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <nav className="flex items-center justify-between gap-2" aria-label="Focus Mode navigation">
        <button
          type="button"
          onClick={() => handleStepChange(stepIndex - 1)}
          disabled={stepIndex === 0}
          className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStepChange(stepIndex + 1)}
            disabled={!canSkip || isLastStep}
            className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#475569] transition hover:bg-[#F8F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/40 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={advance}
            disabled={!requiredFieldsComplete}
            className="pp-cta-gradient rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#331E6D]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </nav>
    </section>
  );
}
