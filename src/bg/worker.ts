// src/bg/worker.ts
import { summarize5, suggestReplies, proofread } from "../lib/ai";
import { heuristicExtract, Actions } from "../lib/actions";

async function setLocal<T>(k: string, v: T) {
  await chrome.storage.local.set({ [k]: v });
}
async function getLocal<T>(k: string): Promise<T | undefined> {
  const r = await chrome.storage.local.get(k);
  return r[k] as T | undefined;
}

// ───────────────────────── side panel bootstrapping ─────────────────────────
async function setPanelOptions() {
  const v = chrome.runtime.getManifest().version;
  // @ts-ignore (sidePanel is MV3+)
  if (chrome.sidePanel?.setOptions) {
    await chrome.sidePanel.setOptions({
      path: `ui/panel.html?v=${encodeURIComponent(v)}`, // cache-bust
      enabled: true,
    });
  }
}
chrome.runtime.onInstalled.addListener(setPanelOptions);
// @ts-ignore
chrome.runtime.onStartup?.addListener(setPanelOptions);

async function openPanelForActiveWindow() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.windowId !== undefined) {
    // @ts-ignore
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
}

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.windowId !== undefined) {
    // @ts-ignore
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// ───────────────────────── message router ─────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case "OPEN_PANEL": {
          await openPanelForActiveWindow();
          sendResponse({ ok: true });
          break;
        }

        case "CLEAR_PANEL": {
          await chrome.storage.local.set({
            bullets: [],
            replies: [],
            actions: { deadlines: [], requests: [], next_steps: [], attachments: [] } as Actions,
          });
          sendResponse({ ok: true });
          break;
        }

        case "THREAD_TEXT": {
          // New thread → reset then summarize
          const text = String(msg.text || "");
          await chrome.storage.local.set({ bullets: [], replies: [] });
          await setLocal("lastThread", text);
          if (msg.threadKey) await setLocal("lastThreadKey", String(msg.threadKey));

          // summarize (respect maxPoints option if present)
          const bullets = await summarize5(text);
          const { maxPoints = 5 } = await chrome.storage.local.get("maxPoints");
          const limited = Array.isArray(bullets) ? bullets.slice(0, Number(maxPoints) || 5) : [];

          await setLocal("bullets", limited);
          sendResponse({ ok: true, bullets: limited });
          break;
        }

        case "REPLY_SUGGEST": {
          const tone = (msg.tone || "concise") as "concise" | "empathetic" | "direct";
          const bullets = (await getLocal<string[]>("bullets")) || [];
          const context = bullets.join(" • ");
          const replies = await suggestReplies(context, tone);
          await setLocal("replies", replies);
          sendResponse({ ok: true, replies });
          break;
        }

        case "PROOFREAD": {
          const before = String(msg.text || "");
          const fixed = await proofread(before);
          sendResponse({ ok: true, fixed, changed: fixed !== before });
          break;
        }

        case "ACTIONS_EXTRACT": {
          // Prefer explicit text; fallback to lastThread
          const text = String(msg.text || (await getLocal<string>("lastThread")) || "");
          let actions: Actions = { deadlines: [], requests: [], next_steps: [], attachments: [] };

          try {
            // Use Built-in AI Writer if available; else heuristics
            // @ts-ignore
            const ai = (globalThis as any).ai;
            if (ai?.writer?.create) {
              const writer = await ai.writer.create({
                systemPrompt:
                  "You extract ACTIONABLE items from an email thread. " +
                  "Return STRICT JSON with keys: deadlines[], requests[], next_steps[], attachments[]. " +
                  "No commentary, JSON only. Each item <= 140 chars.",
              });
              const raw = String(await writer.generate({ input: text }));
              try {
                const parsed = JSON.parse(raw);
                actions = {
                  deadlines: parsed?.deadlines ?? [],
                  requests: parsed?.requests ?? [],
                  next_steps: parsed?.next_steps ?? [],
                  attachments: parsed?.attachments ?? [],
                };
              } catch {
                actions = heuristicExtract(text);
              }
            } else {
              actions = heuristicExtract(text);
            }
          } catch {
            actions = heuristicExtract(text);
          }

          await setLocal("actions", actions);
          sendResponse({ ok: true, actions });
          break;
        }

        default:
          sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (e) {
      console.error("IZW BG error:", e);
      sendResponse({ ok: false, error: String(e) });
    }
  })();

  // keep the channel open for async
  return true;
});