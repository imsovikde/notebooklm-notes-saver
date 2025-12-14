// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('NotebookLM Copy + History installed (fixed)');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'openView') {
    const url = chrome.runtime.getURL('view.html') + (message.id ? '?id=' + encodeURIComponent(message.id) : '');
    chrome.tabs.create({ url });
    sendResponse({ ok: true });
    return true;
  }
});
