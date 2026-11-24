# PandaPilot UI & Engineering Skill Rules

Apply these rules strictly across every component, stylesheet, and interactive flow in the PandaPilot workspace.

## 1. Zero-Backend Guarantee
- **100% Client-Side Execution:** All state, true-cost math, dark-pattern detectors, prompt-injection firewall scanning, persona vault storage, cached replay steps, and voice simulation MUST run deterministically in React state, `localStorage`, and TypeScript modules.
- **Zero External Dependencies at Runtime:** Never require API keys, Python/FastAPI servers, or external network requests for any feature to function.
- **Native Browser APIs with Guaranteed Fallbacks:** Use the browser Web Speech API (`en-IN`, `hi-IN`, `ta-IN`) when available, and always pair it with a 1-click deterministic simulation button (`Simulate Tamil Voice` / `Simulate Tamil/Tanglish Voice`) so demos work on any machine or microphone setup.

## 2. Visual Polish & Design System
- **Aesthetic:** Crisp, modern SaaS + Chrome Extension MV3 aesthetic. Clean hierarchy, generous whitespace, subtle elevation, and zero cluttered or generic boxes.
- **Surfaces & Borders:**
  - Primary Surface: Pure White `#FFFFFF`
  - Secondary / Canvas Surface: Cool Gray `#F8F9FC`
  - Borders: `1px solid #E2E8F0`
  - Card Radius: `12px` (`rounded-xl`)
  - Elevation: Subtle soft shadows (`shadow-sm`, `0 4px 20px -2px rgba(30, 27, 75, 0.06)`)
  - Transitions: Smooth `150ms–250ms` CSS transitions (`transition-all duration-200`)
- **Color System:**
  - **Primary Accent (Deep Royal Purple):** `#331E6D` (hover `#271556`, light tint `#F3F0FF`)
  - **Primary CTA Gradient (Coral → Magenta):** `linear-gradient(135deg, #D9433B 0%, #9B2257 100%)`
  - **Headings (Dark Indigo):** `#1E1B4B`
  - **Body Text (Slate):** `#475569` (muted `#64748B`)
  - **Verified / ₹0-Cost / Safe (Emerald):** `#059669` (tint `#ECFDF5`, border `#A7F3D0`)
  - **Dark-Pattern / Paywall Warning (Amber):** `#D97706` (tint `#FFFBEB`, border `#FDE68A`)
  - **Safety-Gate Abort / Blocked Threat (Crimson):** `#DC2626` (tint `#FEF2F2`, border `#FECACA`)

## 3. Zero Dead UI Policy
- Every button, tab, React Flow node, source-anchor pill, spotlight toggle, mic/simulation control, persona switch, firewall inspector, and modal MUST have real interactive state and immediate visual feedback.
- Cross-panel interactions (e.g., clicking a Side Panel source anchor or warning pill) MUST switch the simulated Chrome browser to the target tab, scroll the matching element into view, and apply a visible highlight pulse/spotlight.

## 4. Product & Architecture Alignment (wHACKiest 2026)
- **Event & Team Identity:** wHACKiest 2026 (Track 2: Beyond the Browser) — Team PandaPilot, SSN College of Engineering, Team ID `e17b46ca`.
- **4 Auto-Routed Modes:**
  1. Mode 1: Smart Discovery, Guided Spotlight & Day-0 Paywall Radar
  2. Mode 2: Purchasing & Planning Visual Mind Map (`@xyflow/react`)
  3. Mode 3: Form Co-Pilot (Persona Vault, Focus Mode, Zero-Leak Inspector, Tamil/Tanglish Voice)
  4. Mode 4: Cached Workflows & Pre-Submit Safety Gate (with Dynamic Page Tampering Abort)
- **4-Layer Cheapest-First Telemetry:**
  - `Layer A: Structured (0 Tokens)`
  - `Layer B: Cached Replay (0 Tokens)`
  - `Layer C: Viewport DOM (~580 Tokens)`
  - `Layer D: Vision Fallback`
- **Zero-Trust Messaging:** Always reflect honest *bounded blast radius by design* — Reader/Actor Privilege Separation, Domain Allowlist, Zero-Leak PII Masking (`0 Bytes PII Sent`), and Pre-Submit Re-Verification Safety Gate.
