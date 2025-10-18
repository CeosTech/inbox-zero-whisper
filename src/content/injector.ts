// src/content/injector.ts
import { extractThreadText, openReplyIfNeeded, insertIntoCompose } from "../lib/gmail";

const BTN_ID = "izw-btn";
let lastThreadKey = threadKeyFromUrl();

// ────────────────────────── utils ──────────────────────────
function threadKeyFromUrl(): string {
  // Gmail changes hash between conversations; Outlook often changes pathname
  return location.hash || location.pathname || "";
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function getViewportRect() {
  return { w: window.innerWidth, h: window.innerHeight };
}

function isElementVisible(el: HTMLElement) {
  return el.offsetParent !== null;
}

/** Robust sendMessage with retries for "context invalidated" etc. */
function sendRuntime<T = any>(payload: any, tries = 3, delayMs = 200): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const attempt = (left: number) => {
      try {
        chrome.runtime.sendMessage(payload, (res) => {
          const err = chrome.runtime.lastError;
          if (err) {
            const msg = String(err.message || err);
            if (left > 1 && /context invalidated|receiving end does not exist/i.test(msg)) {
              return setTimeout(() => attempt(left - 1), delayMs);
            }
            return reject(err);
          }
          resolve(res as T);
        });
      } catch (e) {
        if (left > 1) return setTimeout(() => attempt(left - 1), delayMs);
        reject(e);
      }
    };
    attempt(tries);
  });
}

async function getPos() {
  const { izwBtnPos } = await chrome.storage.local.get("izwBtnPos");
  return izwBtnPos as { x: number; y: number } | undefined;
}
async function setPos(pos: { x: number; y: number }) {
  await chrome.storage.local.set({ izwBtnPos: pos });
}

// ───────────────────── draggable / button ───────────────────
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
    box.style.top  = `${y}px`;
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

    // clamp to viewport before saving
    const rect = box.getBoundingClientRect();
    const { w, h } = getViewportRect();
    const clamped = {
      x: clamp(rect.left, 8, Math.max(8, w - rect.width - 8)),
      y: clamp(rect.top,  8, Math.max(8, h - rect.height - 8)),
    };
    box.style.left = `${clamped.x}px`;
    box.style.top  = `${clamped.y}px`;
    await setPos(clamped);
  };

  box.addEventListener("mousedown", onDown);
  box.addEventListener("touchstart", onDown, { passive: true });

  // keep inside viewport on resize
  window.addEventListener("resize", async () => {
    if (!isElementVisible(box)) return;
    const rect = box.getBoundingClientRect();
    const { w, h } = getViewportRect();
    const x = clamp(rect.left, 8, Math.max(8, w - rect.width - 8));
    const y = clamp(rect.top,  8, Math.max(8, h - rect.height - 8));
    box.style.left = `${x}px`;
    box.style.top  = `${y}px`;
    await setPos({ x, y });
  });
}

async function ensureButton() {
  const root = document;
  if (!root?.body) return;

  // respect Options
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
    cursor: "grab",
    userSelect: "none"
  } as CSSStyleDeclaration);

  // restore pos
  const pos = await getPos();
  if (pos) {
    box.style.left = `${pos.x}px`;
    box.style.top  = `${pos.y}px`;
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
      if (!text?.trim()) {
        alert("Open an email thread first, then click Summarize.");
        return;
      }

      await sendRuntime({ type: "THREAD_TEXT", text, threadKey: threadKeyFromUrl() });
      await sendRuntime({ type: "OPEN_PANEL" });
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      if (/context invalidated|receiving end does not exist/i.test(msg)) {
        alert("The extension was reloaded. Please refresh the Gmail tab and try again.");
      } else {
        console.warn("IZW click error:", e);
        alert("Unexpected error. Refresh Gmail and try again.");
      }
    }
  });
}

// ─────────── live reaction to Options (show/hide) ──────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if ("showFloat" in changes || "izwBtnHidden" in changes) {
    // Re-evaluate the floating button presence
    void ensureButton();
  }
});

// Initial injection + DOM watch (for SPA changes)
const mo = new MutationObserver(() => { void ensureButton(); });
mo.observe(document.documentElement, { childList: true, subtree: true });
void ensureButton();

// ─────────── clear panel when switching threads ────────────
setInterval(async () => {
  const k = threadKeyFromUrl();
  if (k && k !== lastThreadKey) {
    lastThreadKey = k;
    try { await sendRuntime({ type: "CLEAR_PANEL" }); } catch {}
  }
}, 1000);

// ───────── receive insert requests from panel ──────────────
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
