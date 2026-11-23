// Service worker. Deliberately tiny: it only lets the keyboard shortcut / install flow open the side panel.
// No network access and no page data pass through here.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});

chrome.commands?.onCommand.addListener(async (command) => {
  if (command !== "open-lens") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
});
