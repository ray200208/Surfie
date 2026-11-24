import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserShell } from './components/BrowserShell';
import { SidePanel } from './components/SidePanel';
import { SecurityDrawer } from './components/SecurityDrawer';
import { SafetyGateModal } from './components/SafetyGateModal';
import { ModeDiscovery } from './components/modes/ModeDiscovery';
import { ModeWhiteboard } from './components/modes/ModeWhiteboard';
import { ModeFormCopilot } from './components/modes/ModeFormCopilot';
import { ModeCachedReplay } from './components/modes/ModeCachedReplay';
import { BROWSER_TABS, PERSONAS, VOICE_ESSAY_PRESETS } from './data/mockData';
import {
  BrowserTabId,
  ExecutionLayerId,
  HackathonFormValues,
  LanguageCode,
  LmsFormValues,
  ModeId,
  PersonaType,
  ReplayStep,
} from './types';

const OVERRIDES_STORAGE_KEY = 'surfie_persona_overrides_v1';

const INITIAL_FORM_VALUES: HackathonFormValues = {
  fullName: '',
  email: '',
  phone: '',
  college: '',
  usn: '',
  essay: '',
  passwordOtp: '',
};

const INITIAL_FILLED_FLAGS: Record<keyof HackathonFormValues, boolean> = {
  fullName: false,
  email: false,
  phone: false,
  college: false,
  usn: false,
  essay: false,
  passwordOtp: false,
};

const INITIAL_LMS_VALUES: LmsFormValues = {
  course: '',
  labWeek: '',
  fileName: '',
  declarationChecked: false,
};

const INITIAL_REPLAY_STEPS: ReplayStep[] = [
  {
    id: 'step-course',
    title: 'Step 1: Select Course & Lab Week',
    selector: 'select#course_id, select#lab_week',
    actionDesc: 'CS304 — Operating Systems Lab (Week 7)',
    status: 'idle',
    durationMs: 140,
  },
  {
    id: 'step-file',
    title: 'Step 2: Attach Verified Lab PDF',
    selector: 'input[type="file"]#lab_upload',
    actionDesc: 'CS304_Lab7_3122255002067.pdf',
    status: 'idle',
    durationMs: 210,
  },
  {
    id: 'step-declare',
    title: 'Step 3: Check Academic Declaration',
    selector: 'input[type="checkbox"]#integrity_ack',
    actionDesc: 'Post-step assertion: checked === true',
    status: 'idle',
    durationMs: 110,
  },
  {
    id: 'step-submit',
    title: 'Step 4: Pre-Submit Safety Gate',
    selector: 'button#submit_assignment',
    actionDesc: 'Mandatory pause & live DOM re-verification before click',
    status: 'idle',
  },
];

export function App() {
  // Core Navigation & Shell State
  const [activeTabId, setActiveTabId] = useState<BrowserTabId>('slidecraft-tool');
  const [language, setLanguage] = useState<LanguageCode>('EN');
  const [executionLayer, setExecutionLayer] = useState<ExecutionLayerId>('A');
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [securityDrawerOpen, setSecurityDrawerOpen] = useState(false);
  const [highlightedAnchor, setHighlightedAnchor] = useState<string | null>(null);

  // Mode 1 State
  const [spotlightEnabled, setSpotlightEnabled] = useState(false);
  const [spotlightStep, setSpotlightStep] = useState(1);
  const [paywallRadarDismissed, setPaywallRadarDismissed] = useState(false);
  const [paywallChatOpen, setPaywallChatOpen] = useState(false);

  // Resizable Sidebar State (width in px)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.max(380, Math.round(window.innerWidth * 0.36)) : 440
  );
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newWidth = rect.right - e.clientX;
    const minW = 330;
    const maxW = Math.max(480, Math.round(rect.width * 0.85));
    setSidebarWidth(Math.min(maxW, Math.max(minW, newWidth)));
  }, []);

  useEffect(() => {
    if (!isDraggingDivider) return;
    const handleMouseUp = () => setIsDraggingDivider(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider, handleMouseMove]);

  // Mode 2 State
  const [fiberFastAddonChecked, setFiberFastAddonChecked] = useState(true);

  // Mode 3 State
  const [activePersona, setActivePersona] = useState<PersonaType>('college');
  const [formValues, setFormValues] = useState<HackathonFormValues>(INITIAL_FORM_VALUES);
  const [filledByPilot, setFilledByPilot] =
    useState<Record<keyof HackathonFormValues, boolean>>(INITIAL_FILLED_FLAGS);
  const [focusMode, setFocusMode] = useState(false);
  const [activeFocusField, setActiveFocusField] = useState<keyof HackathonFormValues | null>(null);
  const [voiceSimActive, setVoiceSimActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [savedOverridesCount, setSavedOverridesCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
      return raw ? Object.keys(JSON.parse(raw)).length : 0;
    } catch {
      return 0;
    }
  });

  // Mode 4 State
  const [lmsValues, setLmsValues] = useState<LmsFormValues>(INITIAL_LMS_VALUES);
  const [replaySteps, setReplaySteps] = useState<ReplayStep[]>(INITIAL_REPLAY_STEPS);
  const [isReplaying, setIsReplaying] = useState(false);
  const [safetyGateOpen, setSafetyGateOpen] = useState(false);
  const [simulateTampering, setSimulateTampering] = useState(false);
  const [tamperAborted, setTamperAborted] = useState(false);
  const [lmsMutatedButtonText, setLmsMutatedButtonText] = useState<string | null>(null);
  const [lmsReceipt, setLmsReceipt] = useState<{ timestamp: string; receiptId: string } | null>(
    null
  );

  // Auto-route activeMode from activeTabId
  const activeTabMeta = BROWSER_TABS.find((t) => t.id === activeTabId) ?? BROWSER_TABS[0];
  const activeMode: ModeId = activeTabMeta.mode;

  // Keep execution layer synced realistically with active mode
  useEffect(() => {
    if (activeMode === 1 || activeMode === 2) {
      setExecutionLayer('A');
    } else if (activeMode === 3) {
      setExecutionLayer('C');
    } else if (activeMode === 4) {
      setExecutionLayer('B');
    }
  }, [activeMode]);

  // Reset paywall radar popup visibility whenever navigating fresh to slidecraft-tool
  const handleSelectTab = (tabId: BrowserTabId) => {
    setActiveTabId(tabId);
    if (tabId === 'slidecraft-tool') {
      setPaywallRadarDismissed(false);
    }
    if (tabId !== 'portal-guide') {
      setSpotlightEnabled(false);
    }
  };

  // Quick-jump mode pills for judges
  const handleSelectMode = (mode: ModeId) => {
    if (mode === 1) handleSelectTab('slidecraft-tool');
    if (mode === 2) handleSelectTab('isp-fiberfast');
    if (mode === 3) handleSelectTab('hackathon-portal');
    if (mode === 4) handleSelectTab('lms-portal');
  };

  // Cross-panel source anchor jump (switches tab, scrolls, pulses)
  const handleJumpToAnchor = (tabId: BrowserTabId, anchorId: string) => {
    if (isPanelExpanded) {
      setIsPanelExpanded(false);
    }
    setActiveTabId(tabId);
    setHighlightedAnchor(anchorId || null);
    if (anchorId) {
      window.setTimeout(() => {
        setHighlightedAnchor((curr) => (curr === anchorId ? null : curr));
      }, 3600);
    }
  };

  // Mode 1: Guided Spotlight step progression
  const handleAdvanceSpotlightStep = () => {
    const nextStep = spotlightStep >= 3 ? 1 : spotlightStep + 1;
    setSpotlightStep(nextStep);
    handleJumpToAnchor('portal-guide', `guide-step-${nextStep}`);
  };

  // Mode 3: Persona & Form Co-Pilot
  const handleAcceptAllSafe = () => {
    const p = PERSONAS[activePersona];
    setFormValues((prev) => ({
      ...prev,
      fullName: p.fullName,
      email: p.email,
      phone: p.phone,
      college: p.college,
      usn: p.usn,
    }));
    setFilledByPilot((prev) => ({
      ...prev,
      fullName: true,
      email: true,
      phone: true,
      college: true,
      usn: true,
    }));
    setExecutionLayer('C');
  };

  const handleSwitchPersona = (persona: PersonaType) => {
    setActivePersona(persona);
    // If fields are already filled by PandaPilot, live-update them immediately!
    const p = PERSONAS[persona];
    setFormValues((prev) => ({
      ...prev,
      fullName: filledByPilot.fullName ? p.fullName : prev.fullName,
      email: filledByPilot.email ? p.email : prev.email,
      phone: filledByPilot.phone ? p.phone : prev.phone,
      college: filledByPilot.college ? p.college : prev.college,
      usn: filledByPilot.usn ? p.usn : prev.usn,
    }));
  };

  const handleChangeFormField = (
    field: keyof HackathonFormValues,
    value: string,
    fromOverride = false
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (fromOverride) {
      setFilledByPilot((prev) => ({ ...prev, [field]: true }));
      try {
        const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        parsed[field] = value;
        localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(parsed));
        setSavedOverridesCount(Object.keys(parsed).length);
      } catch {
        // Ignore storage errors
      }
    }
  };

  const handleResetForm = () => {
    setFormValues(INITIAL_FORM_VALUES);
    setFilledByPilot(INITIAL_FILLED_FLAGS);
    setVoiceTranscript(null);
  };

  const handleTriggerTamilVoiceForm = () => {
    setLanguage('TA');
    if (activeMode !== 3) {
      setActiveTabId('hackathon-portal');
    }
    setVoiceSimActive(true);
    setExecutionLayer('C');
    window.setTimeout(() => {
      setVoiceSimActive(false);
      setVoiceTranscript(VOICE_ESSAY_PRESETS.transcriptTamil);
    }, 1100);
  };

  const handleInsertEssay = (text: string) => {
    setFormValues((prev) => ({ ...prev, essay: text }));
    setFilledByPilot((prev) => ({ ...prev, essay: true }));
    setActiveFocusField('essay');
  };

  // Multilingual Command Bar Router
  const handlePromptSubmit = (prompt: string) => {
    const q = prompt.toLowerCase();
    if (q.includes('broadband') || q.includes('compare') || q.includes('isp') || q.includes('plan')) {
      handleSelectTab('isp-fiberfast');
    } else if (q.includes('form') || q.includes('apply') || q.includes('fill') || q.includes('hackathon')) {
      handleSelectTab('hackathon-portal');
      handleAcceptAllSafe();
    } else if (q.includes('lms') || q.includes('lab') || q.includes('replay') || q.includes('submit')) {
      handleSelectTab('lms-portal');
      handleRunReplay();
    } else if (q.includes('spotlight') || q.includes('scholarship') || q.includes('guide')) {
      setActiveTabId('portal-guide');
      setSpotlightEnabled(true);
      setSpotlightStep(1);
    } else {
      handleSelectTab('slidecraft-tool');
      setPaywallChatOpen(true);
    }
  };

  // Mode 4: Cached Replay & Safety Gate
  const handleRunReplay = () => {
    setActiveTabId('lms-portal');
    setExecutionLayer('B');
    setIsReplaying(true);
    setTamperAborted(false);
    setLmsMutatedButtonText(null);
    setLmsReceipt(null);

    setReplaySteps(
      INITIAL_REPLAY_STEPS.map((s, idx) => ({
        ...s,
        status: idx === 0 ? 'running' : 'idle',
      }))
    );

    // Step 1 (~240ms)
    window.setTimeout(() => {
      setLmsValues((prev) => ({
        ...prev,
        course: 'CS304 — Operating Systems Lab',
        labWeek: 'Week 7 — Semaphores & Deadlock',
      }));
      setReplaySteps((prev) =>
        prev.map((s, idx) =>
          idx === 0 ? { ...s, status: 'done' } : idx === 1 ? { ...s, status: 'running' } : s
        )
      );
    }, 240);

    // Step 2 (~520ms)
    window.setTimeout(() => {
      setLmsValues((prev) => ({
        ...prev,
        fileName: 'CS304_Lab7_3122255002067.pdf',
      }));
      setReplaySteps((prev) =>
        prev.map((s, idx) =>
          idx === 1 ? { ...s, status: 'done' } : idx === 2 ? { ...s, status: 'running' } : s
        )
      );
    }, 520);

    // Step 3 (~780ms) -> Pause at Safety Gate
    window.setTimeout(() => {
      setLmsValues((prev) => ({
        ...prev,
        declarationChecked: true,
      }));
      setReplaySteps((prev) =>
        prev.map((s, idx) =>
          idx === 2 ? { ...s, status: 'done' } : idx === 3 ? { ...s, status: 'paused' } : s
        )
      );
      setIsReplaying(false);
      setSafetyGateOpen(true);
    }, 780);
  };

  const handleConfirmExecute = () => {
    if (simulateTampering) {
      const mutated = 'Submit & Pay ₹500 Fine';
      setLmsMutatedButtonText(mutated);
      setTamperAborted(true);
      setReplaySteps((prev) =>
        prev.map((s, idx) => (idx === 3 ? { ...s, status: 'aborted' } : s))
      );
      return;
    }

    // Safe execution succeeds
    setTamperAborted(false);
    setLmsMutatedButtonText(null);
    setReplaySteps((prev) =>
      prev.map((s, idx) => (idx === 3 ? { ...s, status: 'done', durationMs: 85 } : s))
    );
    setLmsReceipt({
      receiptId: `SSN-CS304-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    });
    setSafetyGateOpen(false);
  };

  const handleResetReplay = () => {
    setLmsValues(INITIAL_LMS_VALUES);
    setReplaySteps(INITIAL_REPLAY_STEPS);
    setIsReplaying(false);
    setSafetyGateOpen(false);
    setTamperAborted(false);
    setLmsMutatedButtonText(null);
    setLmsReceipt(null);
  };

  return (
    <div
      ref={containerRef}
      className={`flex h-screen w-screen overflow-hidden bg-[#F8F9FC] ${
        isDraggingDivider ? 'cursor-col-resize select-none' : ''
      }`}
    >
      {/* Left: Simulated Chrome Browser (collapses smoothly when Side Panel expands) */}
      <div
        className={`h-full min-w-0 ${
          isDraggingDivider ? '' : 'transition-all duration-200 ease-in-out'
        } ${isPanelExpanded ? 'w-0 opacity-0 pointer-events-none overflow-hidden' : 'flex-1'}`}
      >
        <BrowserShell
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          language={language}
          highlightedAnchor={highlightedAnchor}
          spotlightEnabled={spotlightEnabled}
          spotlightStep={spotlightStep}
          onAdvanceSpotlightStep={handleAdvanceSpotlightStep}
          onToggleSpotlight={(enabled) => {
            setSpotlightEnabled(enabled);
            if (enabled) setActiveTabId('portal-guide');
          }}
          paywallRadarDismissed={paywallRadarDismissed}
          onDismissPaywallRadar={() => setPaywallRadarDismissed(true)}
          onOpenPaywallChat={() => {
            setPaywallChatOpen(true);
            setPaywallRadarDismissed(true);
          }}
          fiberFastAddonChecked={fiberFastAddonChecked}
          onToggleFiberFastAddon={setFiberFastAddonChecked}
          formValues={formValues}
          filledByPilot={filledByPilot}
          onChangeFormField={handleChangeFormField}
          activePersona={activePersona}
          focusMode={focusMode}
          activeFocusField={activeFocusField}
          onSelectFocusField={setActiveFocusField}
          lmsValues={lmsValues}
          onChangeLmsValues={(patch) => setLmsValues((prev) => ({ ...prev, ...patch }))}
          lmsMutatedButtonText={lmsMutatedButtonText}
          lmsReceipt={lmsReceipt}
          onManualLmsSubmitClick={() => setSafetyGateOpen(true)}
        />
      </div>

      {/* Draggable Resize Divider */}
      {!isPanelExpanded && (
        <div
          onMouseDown={() => setIsDraggingDivider(true)}
          title="Drag to resize Side Panel"
          className={`group relative z-30 flex w-2 shrink-0 cursor-col-resize items-center justify-center transition-colors ${
            isDraggingDivider ? 'bg-[#331E6D]/25' : 'bg-[#E2E8F0]/70 hover:bg-[#331E6D]/20'
          }`}
        >
          <div
            className={`h-10 w-1 rounded-full transition-colors ${
              isDraggingDivider ? 'bg-[#331E6D]' : 'bg-[#94A3B8] group-hover:bg-[#331E6D]'
            }`}
          />
        </div>
      )}

      {/* Right: PandaPilot Chrome Extension Side Panel (user-resizable + expandable) */}
      <div
        style={isPanelExpanded ? undefined : { width: `${sidebarWidth}px` }}
        className={`h-full shrink-0 ${
          isDraggingDivider ? '' : 'transition-[width] duration-200 ease-in-out'
        } ${isPanelExpanded ? 'w-full' : ''}`}
      >
        <SidePanel
          activeMode={activeMode}
          onSelectMode={handleSelectMode}
          isExpanded={isPanelExpanded}
          onToggleExpand={() => setIsPanelExpanded((prev) => !prev)}
          language={language}
          onChangeLanguage={setLanguage}
          executionLayer={executionLayer}
          onOpenSecurityDrawer={() => setSecurityDrawerOpen(true)}
          onPromptSubmit={handlePromptSubmit}
          onSimulateTamilVoice={handleTriggerTamilVoiceForm}
        >
          {activeMode === 1 && (
            <ModeDiscovery
              activeTabId={activeTabId}
              language={language}
              spotlightEnabled={spotlightEnabled}
              spotlightStep={spotlightStep}
              onToggleSpotlight={setSpotlightEnabled}
              onSelectSpotlightStep={setSpotlightStep}
              paywallChatOpen={paywallChatOpen}
              onTogglePaywallChat={setPaywallChatOpen}
              onJumpToAnchor={handleJumpToAnchor}
            />
          )}

          {activeMode === 2 && (
            <ModeWhiteboard
              fiberFastAddonChecked={fiberFastAddonChecked}
              isExpanded={isPanelExpanded}
              onToggleExpand={() => setIsPanelExpanded((prev) => !prev)}
              onJumpToAnchor={handleJumpToAnchor}
            />
          )}

          {activeMode === 3 && (
            <ModeFormCopilot
              activePersona={activePersona}
              onSwitchPersona={handleSwitchPersona}
              formValues={formValues}
              filledByPilot={filledByPilot}
              onAcceptAllSafe={handleAcceptAllSafe}
              onResetForm={handleResetForm}
              onChangeFormField={handleChangeFormField}
              focusMode={focusMode}
              onToggleFocusMode={setFocusMode}
              activeFocusField={activeFocusField}
              onSelectFocusField={setActiveFocusField}
              voiceSimActive={voiceSimActive}
              voiceTranscript={voiceTranscript}
              onTriggerTamilVoiceForm={handleTriggerTamilVoiceForm}
              onInsertEssay={handleInsertEssay}
              savedOverridesCount={savedOverridesCount}
            />
          )}

          {activeMode === 4 && (
            <ModeCachedReplay
              steps={replaySteps}
              isReplaying={isReplaying}
              onRunReplay={handleRunReplay}
              onOpenSafetyGate={() => setSafetyGateOpen(true)}
              onResetReplay={handleResetReplay}
              aborted={tamperAborted}
              receipt={lmsReceipt}
            />
          )}
        </SidePanel>
      </div>

      {/* Zero-Trust Security Drawer */}
      <SecurityDrawer
        open={securityDrawerOpen}
        onClose={() => setSecurityDrawerOpen(false)}
        activeLayer={executionLayer}
        onSelectLayer={setExecutionLayer}
        blockedInjectionsCount={1}
      />

      {/* Mode 4 Pre-Submit Safety Gate Modal */}
      <SafetyGateModal
        open={safetyGateOpen}
        onClose={() => setSafetyGateOpen(false)}
        lmsValues={lmsValues}
        simulateTampering={simulateTampering}
        onToggleTampering={setSimulateTampering}
        onConfirmExecute={handleConfirmExecute}
        aborted={tamperAborted}
        mutatedButtonText={lmsMutatedButtonText}
        onResetAbort={() => {
          setTamperAborted(false);
          setLmsMutatedButtonText(null);
          setSimulateTampering(false);
          setReplaySteps((prev) =>
            prev.map((s, idx) => (idx === 3 ? { ...s, status: 'paused' } : s))
          );
        }}
      />
    </div>
  );
}

export default App;
