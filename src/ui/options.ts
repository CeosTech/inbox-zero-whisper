// src/ui/options.ts
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id: string) => document.getElementById(id)!;

  const toneSel     = $("tone") as HTMLSelectElement;
  const maxPointsEl = $("maxPoints") as HTMLInputElement;
  const themeSel    = $("theme") as HTMLSelectElement;
  const fontScale   = $("fontScale") as HTMLInputElement;
  const fontScaleVal= $("fontScaleVal") as HTMLSpanElement;
  const showFloat   = $("showFloat") as HTMLInputElement;
  const resetPos    = $("resetPos") as HTMLButtonElement;
  const clearData   = $("clearData") as HTMLButtonElement;
  const openPanel   = $("openPanel") as HTMLButtonElement;
  const saveBtn     = $("save") as HTMLButtonElement;
  const aiStatus    = $("aiStatus") as HTMLDivElement;
  const logo        = $("logo") as HTMLImageElement;

  // logo
  logo.src = chrome.runtime.getURL("icons/icon-32.png");

  const defaults = { tone: "concise", maxPoints: 5, theme: "auto", fontScale: 100, showFloat: true };

  chrome.storage.local.get(Object.keys(defaults)).then((v) => {
    toneSel.value       = (v.tone ?? defaults.tone) as string;
    maxPointsEl.value   = String(v.maxPoints ?? defaults.maxPoints);
    themeSel.value      = (v.theme ?? defaults.theme) as string;
    fontScale.value     = String(v.fontScale ?? defaults.fontScale);
    fontScaleVal.textContent = `${v.fontScale ?? defaults.fontScale}%`;
    showFloat.checked   = (v.showFloat ?? defaults.showFloat) === true;
    applyPreviewTheme(themeSel.value);
  });

  // live UI
  fontScale.addEventListener("input", () => (fontScaleVal.textContent = fontScale.value + "%"));
  themeSel.addEventListener("change", () => applyPreviewTheme(themeSel.value));

  // save
  saveBtn.addEventListener("click", async () => {
    const payload = {
      tone: toneSel.value,
      maxPoints: Number(maxPointsEl.value) || 5,
      theme: themeSel.value,
      fontScale: Number(fontScale.value) || 100,
      showFloat: showFloat.checked,
    };
    await chrome.storage.local.set(payload);
    saveBtn.textContent = "Saved ✓";
    setTimeout(() => (saveBtn.textContent = "Save"), 1000);
  });

  resetPos.addEventListener("click", async () => {
    await chrome.storage.local.remove("izwBtnPos");
    alert("Position reset. Refresh Gmail to apply.");
  });

  clearData.addEventListener("click", async () => {
    await chrome.storage.local.set({ bullets: [], replies: [], lastThread: "", lastThreadKey: "" });
    alert("Cleared. The panel will be empty on next open.");
  });

  openPanel.addEventListener("click", async () => {
    try {
      await chrome.runtime.sendMessage({ type: "OPEN_PANEL" });
    } catch {
      alert("Could not open the side panel. Ensure the extension is loaded.");
    }
  });

  // built-in AI status
  const hasSumm  = !!(globalThis as any).ai?.summarizer?.create;
  const hasWrit  = !!(globalThis as any).ai?.writer?.create;
  const hasProof = !!(globalThis as any).ai?.proofreader?.create;
  aiStatus.textContent = (hasSumm || hasWrit || hasProof)
    ? "Built-in AI: available (local)"
    : "Built-in AI: not available (fallback)";

  function applyPreviewTheme(theme: string) {
    const root = document.documentElement;
    // default dark
    let vars: Record<string,string> = {
      "--bg":"#0f1115","--card":"#171a21","--muted":"#aab0bf","--text":"#e7ecf3","--accent":"#4f8cff","--border":"#262b36"
    };
    if (theme === "light" || (theme === "auto" && matchMedia("(prefers-color-scheme: light)").matches)) {
      vars = {
        "--bg":"#f7f9fc","--card":"#ffffff","--muted":"#5b6474","--text":"#0d1117","--accent":"#2f6fed","--border":"#e3e8f0"
      };
    }
    Object.entries(vars).forEach(([k,v])=> root.style.setProperty(k,v));
  }
});
