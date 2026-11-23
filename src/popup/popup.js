// Popup: a small launcher. Opening the popup grants activeTab for the current page; the side panel does the work.
const chip = document.getElementById("deviceChip");

(async () => {
  const LM = self.LanguageModel;
  let s = "unsupported";
  if (LM && typeof LM.availability === "function") {
    try { s = await LM.availability({ expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] }); } catch { s = "unsupported"; }
  }
  const ok = s === "available";
  chip.className = "chip " + (ok ? "chip-device" : s === "downloadable" || s === "downloading" ? "chip-neutral" : "chip-cloud");
  chip.textContent = ok ? "Private on-device model: ready" : s === "downloadable" || s === "downloading" ? "Private on-device model: needs download" : "On-device not available here: cloud fallback";
})();

document.getElementById("open").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.sidePanel.open({ windowId: tab.windowId });
  window.close();
});
