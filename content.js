(function() {
  // Prevent duplicate injections
  if (window.imageCopyExtensionLoaded) return;
  window.imageCopyExtensionLoaded = true;

  let currentImage = null;
  let hideTimeout = null;

  // Create the copy button
  const copyBtn = document.createElement('div');
  copyBtn.className = 'image-copy-extension-btn';
  copyBtn.innerHTML = `
    <svg class="image-copy-extension-icon" viewBox="0 0 24 24">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    <span class="image-copy-extension-text">Copy</span>
  `;
  document.body.appendChild(copyBtn);

  // Helper to convert data URL to Blob
  function dataURLToBlob(dataURL) {
    const parts = dataURL.split(',');
    const match = parts[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/png';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  // Handle the copy action
  async function copyImageToClipboard(imgUrl) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetchImage', url: imgUrl }, resolve);
      });

      if (!response || !response.success) {
        throw new Error(response ? response.error : 'No response from background script');
      }

      const blob = dataURLToBlob(response.dataUrl);
      
      // Ensure the blob is of a type supported by clipboard (png)
      // Some images might be jpeg/webp, we may need to convert them to png via canvas.
      let finalBlob = blob;
      if (blob.type !== 'image/png') {
        finalBlob = await convertBlobToPng(blob);
      }

      const item = new ClipboardItem({ [finalBlob.type]: finalBlob });
      await navigator.clipboard.write([item]);
      return true;
    } catch (err) {
      console.error('Failed to copy image:', err);
      return false;
    }
  }

  // Helper to convert non-PNG blobs to PNG for clipboard support
  function convertBlobToPng(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) resolve(pngBlob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Image load failed during conversion'));
      img.src = URL.createObjectURL(blob);
    });
  }

  // Button click listener
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!currentImage || !currentImage.src) return;

    const originalHtml = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg class="image-copy-extension-icon" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span class="image-copy-extension-text">Copying...</span>
    `;

    const success = await copyImageToClipboard(currentImage.src);

    if (success) {
      copyBtn.classList.add('success');
      copyBtn.innerHTML = `
        <svg class="image-copy-extension-icon" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span class="image-copy-extension-text">Copied!</span>
      `;
    } else {
      copyBtn.classList.add('error');
      copyBtn.innerHTML = `
        <svg class="image-copy-extension-icon" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        <span class="image-copy-extension-text">Failed</span>
      `;
    }

    setTimeout(() => {
      copyBtn.classList.remove('success', 'error');
      copyBtn.innerHTML = originalHtml;
    }, 2000);
  });

  // Keep button visible when hovered
  copyBtn.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
  });
  copyBtn.addEventListener('mouseleave', () => {
    hideButton();
  });

  function positionButton(img) {
    const rect = img.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    // Position at middle-right edge, 10px padding from the right
    // We calculate middle by finding the center of the image and subtracting half the button's height
    const buttonHeight = copyBtn.offsetHeight || 32;
    copyBtn.style.top = `${rect.top + scrollTop + (rect.height / 2) - (buttonHeight / 2)}px`;
    
    // We set left explicitly based on image right edge minus some space
    // Let's use right positioning if possible, but absolute needs explicit top/left usually
    copyBtn.style.left = `${rect.right + scrollLeft - copyBtn.offsetWidth - 10}px`;
  }

  function showButton(img) {
    clearTimeout(hideTimeout);
    currentImage = img;
    
    // Position before showing to avoid flicker
    copyBtn.classList.remove('visible');
    copyBtn.style.display = 'flex'; // Ensure it's rendered for offsetWidth calculation
    
    positionButton(img);
    
    // Small delay to allow CSS transition to trigger after positioning
    requestAnimationFrame(() => {
      copyBtn.classList.add('visible');
    });
  }

  function hideButton() {
    hideTimeout = setTimeout(() => {
      copyBtn.classList.remove('visible');
      currentImage = null;
    }, 150); // slight delay to allow moving mouse to the button
  }

  // Event delegation on document to catch all image hovers
  document.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'IMG') {
      const img = e.target;
      // Ignore tiny icons or tracking pixels
      if (img.width < 40 || img.height < 40) return;
      showButton(img);
    }
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (e.target.tagName === 'IMG') {
      hideButton();
    }
  }, true);

  // Update position on scroll/resize if button is visible
  window.addEventListener('scroll', () => {
    if (currentImage && copyBtn.classList.contains('visible')) {
      positionButton(currentImage);
    }
  }, { passive: true });
  
  window.addEventListener('resize', () => {
    if (currentImage && copyBtn.classList.contains('visible')) {
      positionButton(currentImage);
    }
  }, { passive: true });
})();
