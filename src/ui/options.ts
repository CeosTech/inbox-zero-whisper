const toneSel = document.getElementById("tone") as HTMLSelectElement | null;
if (toneSel) {
  chrome.storage.local.get("tone").then(({ tone }) => { if (tone) toneSel.value = tone; });
  toneSel.onchange = () => chrome.storage.local.set({ tone: toneSel.value });
}
