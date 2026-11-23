// Popup: a small launcher. Opening the popup grants activeTab for the current page; the side panel does the work.
// The chip uses the same mapper as the side panel (src/shared/mode.js). The popup shows no results, so there is no mode bar here.
import { chipState } from "../shared/mode.js";

const chip = document.getElementById("deviceChip");

async function refresh() {
  const LM = self.LanguageModel;
  let s = "unsupported";
  if (LM && typeof LM.availability === "function") {
    try { s = await LM.availability({ expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] }); } catch { s = "unsupported"; }
  }
  const st = chipState(s);
  chip.className = st.cls;
  chip.textContent = st.text;
  chip.title = st.tip;
  chip.setAttribute("aria-label", st.text);
  if (s === "downloading") setTimeout(refresh, 2000); // turns green by itself when the download finishes
}
refresh();

document.getElementById("open").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.sidePanel.open({ windowId: tab.windowId });
  window.close();
});
