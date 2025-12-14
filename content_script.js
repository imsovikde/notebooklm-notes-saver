// content_script.js — robust selectors, dedupe, toast, no inline scripts
(function () {
  'use strict';

  const HISTORY_KEY = 'nlm_history_v3';
  const MAX_ITEMS = 500;

  function uid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function showToast(text, timeout = 1500) {
    try {
      const t = document.createElement('div');
      t.className = 'nlm-toast';
      t.textContent = text;
      document.body.appendChild(t);
      setTimeout(() => t.style.opacity = '1', 20);
      setTimeout(() => { t.remove(); }, timeout);
    } catch (e) { console.log('toast fail', e); }
  }

  // Attempt many selectors for title
  function findTitle() {
    const titleCandidates = [
      '.note-header__editable-title', // <--- ADDED: High priority selector for your specific issue
      'input[aria-label*="Title"]',
      'input[placeholder*="Title"]',
      'input[name*="title"]',
      '.note-title',
      '.editor-title',
      'h1',
      'h2',
      '.title',
      '[data-testid="note-title"]'
    ];
    for (const sel of titleCandidates) {
      const el = document.querySelector(sel);
      if (el) {
        // input or contenteditable
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value.trim();
        if (el.isContentEditable) return el.textContent.trim();
        return el.textContent.trim();
      }
    }
    // fallback to url anchor or 'Untitled'
    const fromUrl = document.title ? document.title.replace(/ - NotebookLM.*$/i, '').trim() : '';
    return fromUrl || 'Untitled';
  }

  // Attempt many selectors for note HTML and plain text
  function findContent() {
    const htmlSelectors = [
      'labs-tailwind-doc-viewer', // custom element
      '.note-editor', '.note-editor--readonly',
      '.note-content', '.document-content',
      'article', 'main', 'div[role="article"]',
      '.docs-viewport'
    ];
    for (const sel of htmlSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerHTML && el.innerHTML.trim().length > 10) {
        return { html: el.innerHTML.trim(), plain: (el.innerText || el.textContent || '').trim() };
      }
    }

    // If above failed, try to extract selection (user might have selected content)
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      const text = sel.toString().trim();
      const html = Array.from(sel.getRangeAt(0).cloneContents().childNodes).map(n => {
        const wrapper = document.createElement('div');
        wrapper.appendChild(n.cloneNode(true));
        return wrapper.innerHTML;
      }).join('') || text;
      return { html: `<div>${html}</div>`, plain: text };
    }

    // last resort: whole body text
    const fallbackText = document.body ? document.body.innerText || document.body.textContent || '' : '';
    const short = fallbackText.trim().split('\n').slice(0, 10).join('\n');
    return { html: `<div>${escapeHtml(short)}</div>`, plain: short.trim() };
  }

  function escapeHtml(s = '') {
    return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  async function writeClipboard(html, plain) {
    try {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobPlain = new Blob([plain], { type: 'text/plain' });
      await navigator.clipboard.write([ new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobPlain }) ]);
      return true;
    } catch (e) {
      // fallback plain copy
      try {
        const ta = document.createElement('textarea');
        ta.value = plain || html.replace(/<[^>]+>/g, '');
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return true;
      } catch (err) {
        console.error('clipboard fallback failed', err);
        return false;
      }
    }
  }

  // Save with dedupe — if identical HTML exists, move to top + update ts (prevent duplicates)
  function saveToHistory(item) {
    return new Promise((resolve) => {
      chrome.storage.local.get([HISTORY_KEY], (res) => {
        let arr = res[HISTORY_KEY] || [];
        // find identical HTML
        const idx = arr.findIndex(x => x.html === item.html);
        if (idx >= 0) {
          // preserve id, update ts, move to front
          item.id = arr[idx].id || item.id;
          arr.splice(idx, 1);
          arr.unshift(item);
        } else {
          arr.unshift(item);
        }
        // cap size
        if (arr.length > MAX_ITEMS) arr = arr.slice(0, MAX_ITEMS);
        chrome.storage.local.set({ [HISTORY_KEY]: arr }, () => resolve(true));
      });
    });
  }

  // Insert button near convert/source area, robustly
  function findFooter() {
    // frequently NotebookLM uses footer/panel elements near control buttons
    const possible = [
      '[data-testid="note-footer"]',
      '.panel-footer',
      '.note-actions',
      '.note-footer',
      '.editor-actions',
      '.actions',
      '.controls'
    ];
    for (const sel of possible) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // fallback: try to find a visible button with text "Convert to source" and use its parent
    const btn = Array.from(document.querySelectorAll('button, a')).find(b => /convert to source|convert/i.test(b.textContent || ''));
    if (btn) return btn.parentElement || btn.closest('div');
    // last fallback: document.body
    return document.body;
  }

  function injectButton(footerEl) {
    if (!footerEl) return;
    // avoid duplicate injection
    if (footerEl.querySelector('.nlm-injected')) return;

    const btn = document.createElement('button');
    btn.className = 'nlm-action-btn nlm-injected';
    btn.setAttribute('type', 'button');
    btn.title = 'Copy note (preserve formatting) & save to history';
    btn.innerHTML = 'Copy note';

    // find best insertion point: after first primary action button or append
    const after = footerEl.querySelector('button, a');
    if (after && after.parentElement) {
      after.parentElement.insertBefore(btn, after.nextSibling);
    } else {
      footerEl.appendChild(btn);
    }

    let clickLock = false;
    btn.addEventListener('click', async () => {
      if (clickLock) return;
      clickLock = true;
      const prevText = btn.textContent;
      btn.textContent = 'Copying…';
      btn.disabled = true;

      const title = findTitle();
      const content = findContent();
      const item = {
        id: uid(),
        title: title || 'Untitled',
        html: content.html || `<div>${escapeHtml(content.plain || '')}</div>`,
        plain: content.plain || title || '',
        url: location.href,
        ts: Date.now()
      };

      // --- CHANGED BLOCK: Explicitly add title to clipboard data ---
      const clipHtml = `<h1>${escapeHtml(item.title)}</h1>` + item.html;
      const clipPlain = `${item.title}\n\n${item.plain}`;
      
      const ok = await writeClipboard(clipHtml, clipPlain);
      // --- END CHANGED BLOCK ---

      await saveToHistory(item);

      // feedback
      if (ok) {
        showToast('Copied and saved to history');
        btn.textContent = 'Copied';
      } else {
        showToast('Saved to history (copy failed)');
        btn.textContent = 'Saved';
      }

      // restore state after short delay
      setTimeout(() => {
        btn.textContent = prevText;
        btn.disabled = false;
        clickLock = false;
      }, 1100);
    });
  }

  // Observe DOM for footer presence and injection, robust to NotebookLM dynamic UI
  const observer = new MutationObserver((mutations) => {
    const footer = findFooter();
    if (footer) injectButton(footer);
  });
  observer.observe(document, { childList: true, subtree: true });

  // initial injection after slight delay to account for dynamic rendering
  window.addEventListener('load', () => setTimeout(() => {
    const footer = findFooter();
    if (footer) injectButton(footer);
  }, 900));

  // also try periodically for first 10 seconds (resilient)
  let tries = 0;
  const interval = setInterval(() => {
    tries++;
    const footer = findFooter();
    if (footer) {
      injectButton(footer);
      clearInterval(interval);
    } else if (tries > 12) clearInterval(interval);
  }, 750);

})();