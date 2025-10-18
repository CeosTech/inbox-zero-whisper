const toneSel = document.getElementById("tone") as HTMLSelectElement | null;

if (toneSel) {
  // valeur par défaut si rien en storage
  chrome.storage.local.get({ tone: "concise" }).then(({ tone }) => {
    toneSel.value = tone;
  });

  // écouteur moderne + try/catch
  toneSel.addEventListener("change", async () => {
    try {
      await chrome.storage.local.set({ tone: toneSel.value });
    } catch (e) {
      console.warn("Failed to save tone:", e);
    }
  });
}
