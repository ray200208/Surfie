# PandaPilot — Chrome Extension (Manifest V3)

Self-contained Chrome Extension (MV3) workspace built inside `extension/` without modifying the Round 1 Vercel web demo in the repository root.

---

## 1. Build & Load in Chrome (`chrome://extensions`)

```bash
cd extension
npm install
npm run build
```

Then load the unpacked extension into Chrome:
1. Open **`chrome://extensions`** in Google Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select **`extension/dist`**.
4. Pin **PandaPilot** in your Chrome toolbar and click the icon to open the Side Panel on any normal webpage (`https://...`).

> **Note:** Chrome restricts content scripts on internal pages (`chrome://`, `chrome-extension://`, Chrome Web Store). Test Spotlight and DOM scanning on any regular website tab (e.g., Wikipedia, GitHub, Google Search, or your campus portal).

---

## 2. Architecture Overview

- **`public/manifest.json`**: Manifest V3 config (`sidePanel`, `storage`, `activeTab`, `tabs`, `scripting`).
- **`src/background/service-worker.ts`**: Enables `openPanelOnActionClick`, routes messages, and broadcasts live tab switches to the Side Panel.
- **`src/content/index.ts` & `src/content/shadowOverlay.ts`**: Bundled as a self-contained classic IIFE (`dist/content.js`) so Chrome never hits ES module import errors. Enforces the hard password/sensitive-field boundary in code and renders isolated Shadow DOM highlights (`#pandapilot-shadow-root`).
- **`src/shared/`**: Locked TypeScript contracts (`types.ts`, `messages.ts`, `storage.ts`) shared across all features.

---

## 3. Team Git Branching & Folder Ownership

To let teammates work in parallel with **zero merge conflicts**, each feature lives in its own isolated folder:

| Owner | Git Branch | Owned Folder | Scope |
| :--- | :--- | :--- | :--- |
| **Teammate 1** | `feat/discovery-spotlight` | `src/features/discovery/` | Guided Spotlight flows, Paywall Alert / free-tier checks, and source anchors |
| **Teammate 2** | `feat/compare-whiteboard` | `src/features/compare/` | `@xyflow/react` Visual Whiteboard, multi-tab extraction, true-cost math, dark-pattern checks |
| **Teammate 3** | `feat/forms-copilot` | `src/features/forms/` | Persona Vault auto-fill, Focus Mode, and Tamil/Hindi voice-to-form |
| **Teammate 4** | `feat/cached-replay` | `src/features/replay/` | Click/input recording (`START_RECORDING` / `STOP_RECORDING`), Cached Replay (`REPLAY_STEP`), and Pre-Submit Safety Gate |

> **Shared Contract Rule:** Do **not** modify `src/shared/types.ts`, `src/shared/messages.ts`, or `src/shared/storage.ts` without syncing with the full team first so no teammate's branch breaks.
