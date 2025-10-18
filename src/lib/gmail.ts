// Extraction thread + insertion dans l’éditeur Gmail

export function extractThreadText(): string {
  const items = Array.from(document.querySelectorAll('div[role="listitem"], div[aria-label="Message"]')) as HTMLElement[];
  const chunks: string[] = [];

  for (const it of items) {
    const body = it.querySelector('div[dir="ltr"], div[dir="auto"]') as HTMLElement | null;
    const subjectEl = document.querySelector('h2.hP, h2.hP span') as HTMLElement | null;
    const senderEl = it.querySelector('span.gD, span[email]') as HTMLElement | null;

    const sender = senderEl?.getAttribute?.("email") || senderEl?.textContent || "";
    const subject = subjectEl?.textContent || "";
    let text = (body?.innerText || "").trim();

    text = scrubQuoted(text);
    text = removeSignatures(text);

    const block = [
      subject ? `Subject: ${subject}` : "",
      sender ? `From: ${sender}` : "",
      text
    ].filter(Boolean).join("\n");
    if (block.trim()) chunks.push(block);
  }

  if (!chunks.length) {
    const whole = document.querySelector('div[role="main"]')?.textContent || "";
    return sanitizeWhitespace(whole).slice(0, 50_000);
  }
  return sanitizeWhitespace(chunks.join("\n\n")).slice(0, 50_000);
}

export async function openReplyIfNeeded(): Promise<void> {
  const replyBtn = document.querySelector('div[aria-label="Reply"]') as HTMLElement | null
    || Array.from(document.querySelectorAll('span')).find((s: any) => s.textContent?.trim() === "Reply") as HTMLElement | null;
  replyBtn?.click();
  await waitFor(() => !!findComposeEditable(), 1500);
}

export function insertIntoCompose(text: string): boolean {
  const editable = findComposeEditable();
  if (!editable) return false;
  const ok = document.execCommand?.("insertText", false, text);
  if (!ok) {
    editable.focus();
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      sel.deleteFromDocument?.();
      sel.getRangeAt(0).insertNode(document.createTextNode(text));
    } else {
      editable.textContent = (editable.textContent || "") + text;
    }
  }
  return true;
}

function findComposeEditable(): HTMLElement | null {
  const cands = Array.from(document.querySelectorAll('div[aria-label="Message Body"], div[contenteditable="true"]')) as HTMLElement[];
  return cands.find(c => c.offsetParent !== null) || null;
}

// — Nettoyage texte —
export function scrubQuoted(text: string): string {
  const lines = text.split("\n").filter(l =>
    !l.startsWith(">") &&
    !/^On .+ wrote:/.test(l) &&
    !/^Le .+ a écrit :/.test(l) &&
    !/From:|De :|Envoyé depuis|Previous message/i.test(l)
  );
  return lines.join("\n");
}
export function removeSignatures(text: string): string {
  return text
    .replace(/--\s*\n.*$/s, "")
    .replace(/Sent from my iPhone.*/i, "")
    .replace(/^\s*Confidentialité.*$/gmi, "");
}
export function sanitizeWhitespace(s: string): string {
  return s.replace(/\u00a0/g, " ").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// wait util
function waitFor(predicate: () => boolean, timeoutMs = 2000, step = 50): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start >= timeoutMs) return reject(new Error("waitFor timeout"));
      setTimeout(tick, step);
    };
    tick();
  });
}
