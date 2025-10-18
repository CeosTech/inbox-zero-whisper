// src/lib/actions.ts
export type Actions = {
  deadlines: string[];
  requests: string[];
  next_steps: string[];
  attachments: string[];
};

// Heuristic fallback (works without Built-in AI)
export function heuristicExtract(text: string): Actions {
  const T = (text || "").replace(/\s+/g, " ").toLowerCase();

  const deadlines = [...T.matchAll(
    /\b(eod|end of day|by (mon|tue|wed|thu|fri|sat|sun)|by \d{1,2}(:\d{2})?\s?(am|pm)?|deadline|due (on|by)\b.*?)\b[.?!]/g
  )].map(m => clip(m[0]));

  const requests = [...T.matchAll(
    /\b(please|could you|can you|we need|action required|kindly|let us know|share|send|provide)\b.*?[.?!]/g
  )].map(m => clip(m[0]));

  const next_steps = [...T.matchAll(
    /\b(next|then|todo|follow up|we will|our plan|action items?)\b.*?[.?!]/g
  )].map(m => clip(m[0]));

  const attachments = [...T.matchAll(
    /\b(attach|attachment|attached|enclosed|pdf|pptx?|xls[xm]?|docx?|screenshot|image)\b.*?[.?!]/g
  )].map(m => clip(m[0]));

  return { deadlines, requests, next_steps, attachments };
}

function clip(s: string) {
  const t = s.trim();
  return t.length > 140 ? t.slice(0, 137) + "…" : t;
}
