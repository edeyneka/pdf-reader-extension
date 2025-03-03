// This script handles the sidebar functionality
// The setPanelState method doesn't exist - removing it

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
}); 