import { summarize5, suggestReplies, proofread } from "../lib/ai";

async function setLocal<T>(k: string, v: T) { await chrome.storage.local.set({ [k]: v }); }
async function getLocal<T>(k: string) { const r = await chrome.storage.local.get(k); return r[k] as T | undefined; }

async function setPanelOptions() {
  const v = chrome.runtime.getManifest().version;
  // @ts-ignore
  if (chrome.sidePanel?.setOptions) {
    await chrome.sidePanel.setOptions({ path: `ui/panel.html?v=${encodeURIComponent(v)}`, enabled: true });
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

chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.windowId !== undefined) {
    // @ts-ignore
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

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
          await chrome.storage.local.set({ bullets: [], replies: [] });
          sendResponse({ ok: true });
          break;
        }
        case "THREAD_TEXT": {
          const text = String(msg.text || "");
          await setLocal("lastThread", text);
          await chrome.storage.local.set({ bullets: [], replies: [] }); // reset panel for new run
          const bullets = await summarize5(text);
          await setLocal("bullets", bullets);
          sendResponse({ ok: true, bullets });
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
        default:
          sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (e) {
      console.error("IZW BG error:", e);
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});
