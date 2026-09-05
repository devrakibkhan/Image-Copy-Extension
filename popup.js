document.addEventListener('DOMContentLoaded', () => {
  const globalToggle = document.getElementById('global-toggle');
  const domainListEl = document.getElementById('domain-list');
  const actionBtn = document.getElementById('action-btn');

  let currentHostname = '';

  // Get current tab's hostname
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length === 0 || !tabs[0].url) {
      actionBtn.textContent = 'Unsupported page';
      actionBtn.disabled = true;
      globalToggle.disabled = true;
      return;
    }
    try {
      const url = new URL(tabs[0].url);
      if (!url.protocol.startsWith('http')) {
        throw new Error('Not HTTP');
      }
      currentHostname = url.hostname.toLowerCase().replace(/^www\./, '');
      loadData();
    } catch (e) {
      actionBtn.textContent = 'Unsupported page';
      actionBtn.disabled = true;
      globalToggle.disabled = true;
    }
  });

  function loadData() {
    chrome.storage.sync.get(['disabledSites', 'globalEnabled'], (result) => {
      const disabledSites = result.disabledSites || [];
      const globalEnabled = result.globalEnabled !== false; // Default true
      
      globalToggle.checked = globalEnabled;

      renderDisabledList(disabledSites);
      updateActionBtn(disabledSites);
    });
  }

  globalToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ globalEnabled: globalToggle.checked });
  });

  function renderDisabledList(sites) {
    domainListEl.innerHTML = '';
    
    if (sites.length === 0) {
      domainListEl.innerHTML = '<div style="font-size: 12px; color: #94a3b8; text-align: center; padding: 12px;">No disabled domains</div>';
      return;
    }

    sites.forEach(site => {
      const item = document.createElement('div');
      item.className = 'domain-item';
      
      const siteName = document.createElement('span');
      siteName.textContent = site;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.innerHTML = '✕';
      removeBtn.title = 'Remove';
      removeBtn.addEventListener('click', () => {
        removeDisabledSite(site);
      });
      
      item.appendChild(siteName);
      item.appendChild(removeBtn);
      domainListEl.appendChild(item);
    });
  }

  function updateActionBtn(disabledSites) {
    if (disabledSites.includes(currentHostname)) {
      actionBtn.innerHTML = `+ Enable ${currentHostname}`;
      actionBtn.classList.remove('remove');
      actionBtn.onclick = () => removeDisabledSite(currentHostname);
    } else {
      actionBtn.innerHTML = `+ Disable ${currentHostname}`;
      actionBtn.classList.add('remove');
      actionBtn.onclick = () => addDisabledSite(currentHostname);
    }
  }

  function removeDisabledSite(siteToRemove) {
    chrome.storage.sync.get(['disabledSites'], (result) => {
      let disabledSites = result.disabledSites || [];
      disabledSites = disabledSites.filter(site => site !== siteToRemove);
      
      chrome.storage.sync.set({ disabledSites }, () => {
        renderDisabledList(disabledSites);
        updateActionBtn(disabledSites);
      });
    });
  }

  function addDisabledSite(siteToAdd) {
    chrome.storage.sync.get(['disabledSites'], (result) => {
      let disabledSites = result.disabledSites || [];
      if (!disabledSites.includes(siteToAdd)) {
        disabledSites.push(siteToAdd);
      }
      chrome.storage.sync.set({ disabledSites }, () => {
        renderDisabledList(disabledSites);
        updateActionBtn(disabledSites);
      });
    });
  }
});
