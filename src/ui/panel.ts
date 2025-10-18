// src/ui/panel.ts

// ---------- tiny helpers ----------
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;

const hasLocalAI = () => {
  const ai = (globalThis as any).ai;
  return !!(ai?.summarizer?.create || ai?.writer?.create || ai?.proofreader?.create);
};

const setLoading = (on: boolean) => {
  ["summarize", "suggest", "reset", "extractActions", "insertPlan"].forEach((id) => {
    const b = $(id) as HTMLButtonElement | null;
    if (b) b.disabled = on;
  });
  const mode = $("mode");
  if (mode) mode.textContent = on ? "…processing" : hasLocalAI() ? "Local (AI)" : "Fallback-first";
};

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

async function getActiveTabUrl(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || "";
}
function keyFromUrl(url: string) {
  try { const u = new URL(url); return u.hash || u.pathname; } catch { return url; }
}

// ---------- theme / font ----------
function applyTheme(theme: string) {
  const root = document.documentElement;
  // default (dark)
  let vars: Record<string, string> = {
    "--bg": "#0f1115",
    "--card": "#171a21",
    "--muted": "#aab0bf",
    "--text": "#e7ecf3",
    "--accent": "#4f8cff",
    "--border": "#262b36",
  };
  if (theme === "light" || (theme === "auto" && matchMedia("(prefers-color-scheme: light)").matches)) {
    vars = {
      "--bg": "#f7f9fc",
      "--card": "#ffffff",
      "--muted": "#5b6474",
      "--text": "#0d1117",
      "--accent": "#2f6fed",
      "--border": "#e3e8f0",
    };
  }
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

// live reactions from Options + clear events
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.fontScale) {
    const val = Number(changes.fontScale.newValue || 100);
    (document.documentElement.style as any).fontSize = `${val}%`;
  }
  if (changes.theme) applyTheme(changes.theme.newValue);

  // When background clears bullets, also clear replies/actions UI
  if (changes.bullets && Array.isArray(changes.bullets.newValue) && changes.bullets.newValue.length === 0) {
    $("bullets") && (($("bullets") as HTMLOListElement).innerHTML = "");
    $("replies") && (($("replies") as HTMLDivElement).innerHTML = "");
    $("actionsList") && (($("actionsList") as HTMLDivElement).innerHTML = "");
  }
});

// ---------- init ----------
(() => {
  const mode = $("mode");
  if (mode) mode.textContent = hasLocalAI() ? "Local (AI)" : "Fallback-first";
  const logo = $("izw-logo") as HTMLImageElement | null;
  if (logo) logo.src = chrome.runtime.getURL("icons/icon-32.png");
})();

chrome.storage.local.get(["theme", "fontScale"]).then(({ theme = "auto", fontScale = 100 }) => {
  applyTheme(theme);
  (document.documentElement.style as any).fontSize = `${fontScale}%`;
});

// ---------- events ----------
$("summarize")?.addEventListener("click", async () => {
  setLoading(true);
  try {
    // prevent stale thread usage
    const url = await getActiveTabUrl();
    const tabKey = keyFromUrl(url);
    const { lastThreadKey, bullets = [] } = await chrome.storage.local.get(["lastThreadKey", "bullets"]);

    if (lastThreadKey && tabKey && lastThreadKey !== tabKey) {
      const list = $("bullets") as HTMLOListElement | null;
      const rep = $("replies") as HTMLDivElement | null;
      if (list) list.innerHTML = "";
      if (rep) rep.innerHTML = "";
      alert("New email detected. Click the floating button to summarize this thread.");
      return;
    }

    const list = $("bullets") as HTMLOListElement | null;
    if (!list) return;
    list.innerHTML = "";
    (bullets as string[]).forEach((b) => {
      const li = document.createElement("li");
      li.textContent = b;
      list.appendChild(li);
    });
    if (!(bullets as string[]).length) {
      alert("Open a thread and click the floating button in Gmail first.");
    }
  } finally {
    setLoading(false);
  }
});

$("suggest")?.addEventListener("click", async () => {
  setLoading(true);
  try {
    const { tone = "concise" } = await chrome.storage.local.get("tone");
    const resp = await sendRuntime<{ ok: boolean; replies: string[] }>({ type: "REPLY_SUGGEST", tone });
    const container = $("replies") as HTMLDivElement | null;
    if (!container) return;
    container.innerHTML = "";

    (resp.replies || []).forEach((text, i) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr auto auto";
      row.style.gap = "8px";
      row.style.alignItems = "start";

      const pre = document.createElement("pre");
      pre.textContent = text;

      const btnInsert = document.createElement("button");
      btnInsert.textContent = `Insert #${i + 1}`;
      btnInsert.onclick = async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) throw new Error("No active tab");
          const res = await chrome.tabs.sendMessage(tab.id, { type: "INSERT_REPLY", text: pre.textContent });
          if (!(res && (res as any).ok)) {
            await navigator.clipboard.writeText(pre.textContent || "");
            alert("Could not insert automatically. The text was copied — paste it in Gmail.");
          }
        } catch {
          await navigator.clipboard.writeText(pre.textContent || "");
          alert("Text copied — paste it in Gmail.");
        }
      };

      const btnFix = document.createElement("button");
      btnFix.textContent = "Correct";
      btnFix.onclick = async () => {
        btnFix.disabled = true;
        try {
          const { fixed, changed } = await sendRuntime<{ ok: boolean; fixed: string; changed: boolean }>({
            type: "PROOFREAD",
            text: pre.textContent,
          });
          pre.textContent = fixed;
          btnFix.textContent = changed ? "Corrected ✓" : "No changes";
        } finally {
          setTimeout(() => {
            btnFix.textContent = "Correct";
            btnFix.disabled = false;
          }, 1200);
        }
      };

      row.appendChild(pre);
      row.appendChild(btnInsert);
      row.appendChild(btnFix);
      container.appendChild(row);
    });
  } finally {
    setLoading(false);
  }
});

$("reset")?.addEventListener("click", async () => {
  await sendRuntime({ type: "CLEAR_PANEL" });
  $("bullets") && (($("bullets") as HTMLOListElement).innerHTML = "");
  $("replies") && (($("replies") as HTMLDivElement).innerHTML = "");
  $("actionsList") && (($("actionsList") as HTMLDivElement).innerHTML = "");
});

// ----- Actions from summary -----
$("extractActions")?.addEventListener("click", async () => {
  setLoading(true);
  try {
    const { lastThread = "" } = await chrome.storage.local.get("lastThread");
    if (!lastThread.trim()) {
      alert("Open an email thread and click the floating Summarize button first.");
      return;
    }
    const { ok, actions, error } = await sendRuntime<{ ok: boolean; actions: any; error?: string }>({
      type: "ACTIONS_EXTRACT",
      text: lastThread,
    });
    if (!ok) throw new Error(String(error || "Action extraction failed"));
    renderActions(actions);
  } catch (e) {
    console.warn("Extract actions error:", e);
    alert("Could not extract actions. Check the Service Worker console for details.");
  } finally {
    setLoading(false);
  }
});

$("insertPlan")?.addEventListener("click", async () => {
  const { actions } = await chrome.storage.local.get("actions");
  if (!actions) return alert("Extract actions first.");

  const md = [
    actions.deadlines?.length ? "Deadlines:\n- " + actions.deadlines.join("\n- ") : "",
    actions.requests?.length ? "Requests:\n- " + actions.requests.join("\n- ") : "",
    actions.next_steps?.length ? "Next steps:\n- " + actions.next_steps.join("\n- ") : "",
    actions.attachments?.length ? "Attachments:\n- " + actions.attachments.join("\n- ") : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    const res = await chrome.tabs.sendMessage(tab.id, { type: "INSERT_REPLY", text: md });
    if (!(res && (res as any).ok)) {
      await navigator.clipboard.writeText(md);
      alert("Plan copied — paste it in Gmail.");
    }
  } catch {
    await navigator.clipboard.writeText(md);
    alert("Plan copied — paste it in Gmail.");
  }
});

function renderActions(a: { deadlines: string[]; requests: string[]; next_steps: string[]; attachments: string[] }) {
  const el = $("actionsList");
  if (!el) return;
  const block = (title: string, arr: string[]) =>
    arr?.length
      ? `<h4>${title}</h4>` +
        arr.map((x) => `<label style="display:block"><input type="checkbox" checked> ${x}</label>`).join("")
      : "";
  el.innerHTML =
    block("Deadlines", a.deadlines) +
    block("Requests", a.requests) +
    block("Next steps", a.next_steps) +
    block("Attachments", a.attachments);
  chrome.storage.local.set({ actions: a });
}

// ---------- Download PDF (print-to-PDF) ----------
$("downloadPdf")?.addEventListener("click", async () => {
  // Pull current data
  const { bullets = [], actions = {}, tone = "concise", lastThread = "" } =
    await chrome.storage.local.get(["bullets", "actions", "tone", "lastThread"]);

  if (!Array.isArray(bullets) || bullets.length === 0) {
    alert("No summary yet. Click Summarize first.");
    return;
  }

  const subject = extractSubjectFrom(lastThread) || "Email Summary";
  const now = new Date();
  const when = now.toLocaleString();

  const html = buildPrintableHTML({
    subject,
    bullets,
    actions: {
      deadlines: actions?.deadlines || [],
      requests: actions?.requests || [],
      next_steps: actions?.next_steps || [],
      attachments: actions?.attachments || []
    },
    tone,
    when
  });

  openPrintable(html);
});

function extractSubjectFrom(threadText: string): string | null {
  // Our content script prefixes messages with "Subject: ..." — reuse that if present.
  const m = threadText?.match(/^Subject:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

function esc(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildPrintableHTML(opts: {
  subject: string;
  bullets: string[];
  actions: { deadlines: string[]; requests: string[]; next_steps: string[]; attachments: string[] };
  tone: string; when: string;
}) {
  const { subject, bullets, actions, tone, when } = opts;
  const actionBlock = (title: string, arr: string[]) =>
    arr?.length
      ? `<h3>${esc(title)}</h3><ul>` + arr.map(x => `<li>${esc(x)}</li>`).join("") + `</ul>`
      : "";

  // Light, print-friendly styling
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${esc(subject)} — Summary</title>
  <style>
    :root{--text:#0d1117;--muted:#5b6474;--border:#e3e8f0;--accent:#2f6fed}
    *{box-sizing:border-box}
    body{font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto;color:var(--text);margin:24px}
    header{margin-bottom:12px}
    h1{font-size:20px;margin:0 0 2px}
    .meta{color:var(--muted);font-size:12px}
    .card{border:1px solid var(--border);border-radius:12px;padding:16px;margin-top:12px}
    h2{font-size:16px;margin:0 0 8px}
    h3{font-size:14px;margin:12px 0 6px}
    ul,ol{margin:6px 0 0 18px}
    .badge{display:inline-block;background:#edf2ff;border:1px solid #cdd9ff;color:#2f3a8f;border-radius:999px;padding:2px 8px;font-size:11px;margin-left:6px}
    @media print{
      body{margin:12mm}
      .no-print{display:none}
    }
  </style>
</head>
<body>
  <header>
    <h1>${esc(subject)} <span class="badge">Inbox Zero Whisper</span></h1>
    <div class="meta">Generated: ${esc(when)} · Tone: ${esc(tone)}</div>
  </header>

  <section class="card">
    <h2>TL;DR (5 bullets)</h2>
    <ol>${bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ol>
  </section>

  <section class="card">
    <h2>Action plan</h2>
    ${actionBlock("Deadlines", actions.deadlines)}
    ${actionBlock("Requests", actions.requests)}
    ${actionBlock("Next steps", actions.next_steps)}
    ${actionBlock("Attachments", actions.attachments)}
  </section>

  <div class="no-print" style="margin-top:12px">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>

  <script>window.addEventListener('load', ()=>{ setTimeout(()=>window.print(), 150); });</script>
</body>
</html>`;
}

function openPrintable(html: string) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) { alert("Popup blocked. Please allow popups for this site."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}