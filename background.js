chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchImage') {
    fetch(request.url)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.blob();
      })
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ success: true, dataUrl: reader.result });
        };
        reader.onerror = () => {
          sendResponse({ success: false, error: 'Failed to read blob' });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.error('Error fetching image:', error);
        sendResponse({ success: false, error: error.toString() });
      });
    return true; // Indicates async response
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "toggle-site",
    title: "Toggle Image Copy on this site",
    contexts: ["all"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toggle-site" && tab.url) {
    const url = new URL(tab.url);
    if (!url.protocol.startsWith('http')) return;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    
    chrome.storage.sync.get(['disabledSites'], (result) => {
      let disabledSites = result.disabledSites || [];
      if (disabledSites.includes(hostname)) {
        disabledSites = disabledSites.filter(s => s !== hostname);
      } else {
        disabledSites.push(hostname);
      }
      chrome.storage.sync.set({ disabledSites });
    });
  }
});
