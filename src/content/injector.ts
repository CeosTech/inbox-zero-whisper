// src/content/injector.ts
import { extractThreadText, openReplyIfNeeded, insertIntoCompose } from "../lib/gmail";

const BTN_ID = "izw-btn";
let lastThreadKey = threadKeyFromUrl();

// ---- helpers ---------------------------------------------------------------
function threadKeyFromUrl() {
  // Gmail updates the hash when you open a conversation
  return location.hash || location.pathname || "";
}

function sendRuntime<T = any>(payload: any): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(payload, (res) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err);
        resolve(res as T);
      });
    } catch (e) { reject(e); }
  });
}

async function getPos() {
  const { izwBtnPos } = await chrome.storage.local.get("izwBtnPos");
  return izwBtnPos as { x: number; y: number } | undefined;
}
async function setPos(pos: { x: number; y: number }) {
  await chrome.storage.local.set({ izwBtnPos: pos });
}

// ---- draggable/closable floating box --------------------------------------
function makeDraggable(box: HTMLDivElement) {
  let dragging = false, startX = 0, startY = 0, origX = 0, origY = 0;

  const onDown = (e: MouseEvent | TouchEvent) => {
    dragging = true;
    const rect = box.getBoundingClientRect();
    origX = rect.left; origY = rect.top;
    const pt = "touches" in e ? e.touches[0] : (e as MouseEvent);
    startX = pt.clientX; startY = pt.clientY;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    box.style.cursor = "grabbing";
  };

  const onMove = (e: MouseEvent | TouchEvent) => {
    if (!dragging) return;
    ("preventDefault" in e) && e.preventDefault();
    const pt = "touches" in e && e.touches[0] ? e.touches[0] : (e as MouseEvent);
    const dx = pt.clientX - startX;
    const dy = pt.clientY - startY;
    const x = origX + dx;
    const y = origY + dy;
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.right = "auto";
    box.style.bottom = "auto";
  };

  const onUp = async () => {
    if (!dragging) return;
    dragging = false;
    box.style.cursor = "grab";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onUp);
    const rect = box.getBoundingClientRect();
    await setPos({ x: rect.left, y: rect.top });
  };

  box.addEventListener("mousedown", onDown);
  box.addEventListener("touchstart", onDown, { passive: true });
}

async function ensureButton() {
  // respect user setting "showFloat" (default true)
  const { showFloat, izwBtnHidden } = await chrome.storage.local.get(["showFloat", "izwBtnHidden"]);
  if (showFloat === false || izwBtnHidden) {
    document.getElementById(BTN_ID)?.remove();
    return;
  }

  if (document.getElementById(BTN_ID)) return;

  const box = document.createElement("div");
  box.id = BTN_ID;
  Object.assign(box.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    background: "#111826",
    color: "#fff",
    border: "1px solid #2b3342",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    display: "flex",
    gap: "8px",
    alignItems: "center",
    padding: "8px 10px",
    font: "13px system-ui, -apple-system, Segoe UI, Roboto",
    cursor: "grab"
  } as CSSStyleDeclaration);

  // restore position if any
  const pos = await getPos();
  if (pos) {
    box.style.left = `${pos.x}px`;
    box.style.top = `${pos.y}px`;
    box.style.right = "auto";
    box.style.bottom = "auto";
  }

  const logo = document.createElement("img");
  logo.alt = "IZW";
  logo.src = chrome.runtime.getURL("icons/icon-16.png");
  Object.assign(logo.style, { width: "16px", height: "16px", marginRight: "6px", display: "block" });

  const label = document.createElement("span");
  label.textContent = "Summarize (Inbox Zero Whisper)";
  label.style.cursor = "pointer";

  const close = document.createElement("button");
  close.textContent = "×";
  Object.assign(close.style, {
    border: "none",
    background: "transparent",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer",
    lineHeight: "1",
    marginLeft: "4px"
  } as CSSStyleDeclaration);
  close.title = "Hide";
  close.addEventListener("click", async (e) => {
    e.stopPropagation();
    box.remove();
    await chrome.storage.local.set({ izwBtnHidden: true });
  });

  box.appendChild(logo);
  box.appendChild(label);
  box.appendChild(close);
  document.body.appendChild(box);
  makeDraggable(box);

  // Click → clear panel → summarize current thread → open side panel
  box.addEventListener("click", async () => {
    try {
      await sendRuntime({ type: "CLEAR_PANEL" });
      const text = extractThreadText();
      await sendRuntime({ type: "THREAD_TEXT", text, threadKey: threadKeyFromUrl() });
      await sendRuntime({ type: "OPEN_PANEL" });
    } catch {
      alert("If you reloaded the extension, refresh Gmail and try again.");
    }
  });
}

// initial injection + DOM watch
new MutationObserver(() => { void ensureButton(); })
  .observe(document.documentElement, { childList: true, subtree: true });
void ensureButton();

// ---- detect thread change and clear panel state ---------------------------
setInterval(async () => {
  const k = threadKeyFromUrl();
  if (k && k !== lastThreadKey) {
    lastThreadKey = k;
    try { await sendRuntime({ type: "CLEAR_PANEL" }); } catch {}
  }
}, 1000);

// ---- receive insert requests from panel -----------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "INSERT_REPLY" && typeof msg.text === "string") {
      try {
        await openReplyIfNeeded();
        const ok = insertIntoCompose(msg.text);
        sendResponse({ ok });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    }
  })();
  return true;
});
