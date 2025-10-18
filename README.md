Inbox Zero Whisper
Chrome extension (MV3) that turns long email threads into 5-bullet TL;DRs, three smart replies, one-click proofreading, and a concise action plan — running on-device with Chrome’s built-in AI for privacy, speed, and offline reliability.

Tagline: Local AI for email: 5-bullet summaries, smart replies, and actions—private, fast, offline-friendly.

✨ Features
Summarize any thread into 5 bullets (configurable)
Suggest 3 replies and Insert with one click
Proofread replies (Correct → Corrected ✓ / No changes)
Actions from Summary: extract deadlines, requests, next steps, attachments → insert an action plan
Draggable quick button in Gmail (hide/reset position from Options)
Side Panel UI with light/dark/auto theme + adjustable text size
Local-first with graceful fallbacks when built-in AI isn’t available
SPA-safe: clears old summaries when you switch threads
🧠 Built with (client-side)
TypeScript, Vite, pnpm
Chrome Extension MV3: Service Worker, Content Scripts, Side Panel API, Options
Chrome Built-in AI (feature-detected): Summarizer API, Writer API, Proofreader API (Falls back to heuristics so UX always works)
Web APIs: DOM, MutationObserver, Clipboard, Chrome storage/tabs
📦 Installation (from source)
Requirements

Node 20+ (or 22+), pnpm 8+
Google Chrome (Stable or Canary)
pnpm install
pnpm run build
Open chrome://extensions
Toggle Developer mode ON
Load unpacked → select the dist/ folder
Open Gmail and look for the floating button (“Summarize (Inbox Zero Whisper)”)
🚀 Quick Start (Gmail)
Open a long thread in Gmail
Click the floating button → the Side Panel opens
Summarize (5 bullets) → see the TL;DR
Suggest 3 Replies → Insert # adds into Gmail (or copies if insertion is blocked)
Click Correct to proofread
Extract actions → Insert plan to paste a checklist of deadlines/requests/next steps
Switching to a different email auto-clears the panel to avoid stale summaries.

⚙️ Options
chrome://extensions → your extension → Extension options

Tone: Concise / Empathetic / Direct
Max bullets (3–7)
Theme: Auto / Light / Dark
Panel text size (90–120%)
Floating button: Show/Hide + Reset position
Data: Clear summary & replies
Quick action: Open side panel
🔒 Privacy
No servers. All processing happens in the browser using Chrome’s built-in AI (when available).
No data leaves the device unless you later enable an optional hybrid/cloud mode (not enabled by default).
🧱 Architecture
Gmail page (SPA)
  └─ content script: extract thread, show draggable button, insert replies, detect thread changes
       ⇅ runtime messages
Background Service Worker
  ├─ calls built-in AI (Summarizer/Writer/Proofreader)
  ├─ stores outputs in chrome.storage.local
  └─ opens Side Panel, resets state on new thread
Side Panel (UI)
  ├─ Summarize / Suggest / Correct / Reset
  └─ Extract actions → Insert plan
Options Page
  └─ Tone, bullets, theme, text size, floating button controls
🧪 Testing
Build & load unpacked (see Install)
Open a long Gmail thread
Click floating button → Summarize → see bullets
Suggest 3 Replies → Insert # + Correct
Extract actions → Insert plan
Change Options (e.g., theme to Light) → open panel: styles update
Drag the floating button → refresh → position persists
Open a different thread → panel clears (no stale TL;DR)
Troubleshooting

After reloading the extension, refresh the Gmail tab.
If panel looks outdated, remove & re-add the unpacked extension (cache-busted path is included).
Icons missing? Ensure files exist under dist/icons/ and match manifest paths.
🏆 Hackathon Notes
Category fit: “Most Helpful – Web/Extension” (clear utility, immediate value)

Multimodal path: add voice-to-reply and image TL;DR via Prompt API (audio/image)

Hybrid path: optional Gemini/Firebase AI for very long threads (with explicit consent banner)

Demo script (<3 min):

Summarize monster thread → bullets + actions
Suggest replies → Correct → Insert
Toggle Light theme + larger text
(Optional) Show Local (AI) badge/offline resilience
🔑 Permissions (manifest)
{
  "permissions": ["activeTab", "tabs", "storage", "sidePanel"],
  "host_permissions": [
    "https://mail.google.com/*",
    "https://outlook.office.com/*"
  ]
}
🗺️ Roadmap
Voice compose (hold-to-talk → draft reply)
Image/PDF attachment Q&A
Reply-All Guard (missing attachment / off-tone / length)
Keyboard shortcuts (S summarize, 1/2/3 insert, F correct, A actions, P plan)
Metrics (local-only): time saved, emails summarized
🧩 Scripts
pnpm run build       # build extension into /dist
pnpm run dev         # (optional) local dev if you wire HMR for the panel/options
📄 License
MIT — see LICENSE.

🙏 Credits
Chrome team for Built-in AI APIs (Prompt, Summarizer, Writer, Proofreader)
Community examples of MV3 + Side Panel patterns
Appendix – Math for time saved
We estimate: [ \Delta t = t_{\text{manual}} - t_{\text{IZW}}, \qquad \text{Gain}(%) = \frac{\Delta t}{t_{\text{manual}}}\times 100 ] If a 30-message thread is ~4 min manually and IZW takes ~40 s: [ \Delta t = 200\text{ s} \Rightarrow \text{Gain} \approx 83% ]

