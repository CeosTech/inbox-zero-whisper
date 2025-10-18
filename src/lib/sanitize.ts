export function toPlain(text: string): string {
  return text.replace(/\r/g, "").replace(/\t/g, " ").replace(/\u00a0/g, " ").replace(/\s{2,}/g, " ").trim();
}
export function clip(text: string, max = 50_000): string {
  return text.length <= max ? text : text.slice(0, max) + "\n[...]";
}
