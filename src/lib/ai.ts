// Wrappers Chrome Built-in AI (fallbacks inclus)

type MaybeAI = any;

function naiveSummarize5(text: string): string[] {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s/).filter(Boolean);
  const picks: string[] = [];
  for (let i = 0; i < sentences.length && picks.length < 5; i += 2) picks.push(sentences[i]);
  return (picks.length ? picks : sentences.slice(0, 5)).map((s) => s.trim());
}

export async function summarize5(text: string): Promise<string[]> {
  const ai = (globalThis as any).ai as MaybeAI;
  try {
    if (ai?.summarizer?.create) {
      const summ = await ai.summarizer.create({ type: "key-points", maxPoints: 5 });
      const res = await summ.summarize(text);
      if (Array.isArray(res)) return res.slice(0, 5);
      return String(res).split(/\n|•|-/).map(s => s.trim()).filter(Boolean).slice(0, 5);
    }
  } catch {}
  return naiveSummarize5(text);
}

function stylePreset(tone: "concise"|"empathetic"|"direct") {
  if (tone === "empathetic") return "Warm, supportive, positive, propose help.";
  if (tone === "direct") return "Direct, clear, short, action-oriented.";
  return "Concise, professional, neutral.";
}

export async function suggestReplies(context: string, tone: "concise"|"empathetic"|"direct"): Promise<string[]> {
  const ai = (globalThis as any).ai as MaybeAI;
  const sys = `You write short email replies. Style: ${stylePreset(tone)} Provide 3 numbered variants.`;
  try {
    if (ai?.writer?.create) {
      const w = await ai.writer.create({ systemPrompt: sys });
      const out = await w.generate({ input: `Context:\n${context}\n\nTask: Draft 3 short replies.` });
      const text = String(out);
      const parts = text.split(/\n\d+\.\s/).map(s => s.trim()).filter(Boolean);
      return (parts.length >= 3 ? parts.slice(0,3) : text.split(/\n?- /).map(s=>s.trim()).filter(Boolean).slice(0,3));
    }
  } catch {}
  // fallback
  return [
    "Thanks for the update — noted. I’ll get back to you by EOD.",
    "Appreciate the details. Two quick questions before I proceed: 1) … 2) …",
    "All good on my side — I’ll share the draft and next steps shortly."
  ];
}

export async function proofread(text: string): Promise<string> {
  const ai = (globalThis as any).ai as MaybeAI;
  try {
    if (ai?.proofreader?.create) {
      const p = await ai.proofreader.create({ tone: "professional" });
      const out = await p.correct(text);
      return String(out);
    }
  } catch {}
  // fallback léger
  return text.replace(/\bi\b/g, "I").replace(/\s{2,}/g, " ").trim();
}
