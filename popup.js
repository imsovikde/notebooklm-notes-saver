// popup.js - Modern Interactive Logic
const HISTORY_KEY = 'nlm_history_v3';
let allItems = [];

// Helper: Format Timestamp
function fmtTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  
  // Smart relative time
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' });
}

function escapeHtml(s = '') {
  return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// Icons (SVGs)
const ICONS = {
  open: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
  copy: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`
};

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 2000);
}

function renderList(items) {
  const list = document.getElementById('list');
  list.innerHTML = '';
  
  if (!items.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div style="font-size:24px;margin-bottom:8px">📝</div>
        No notes found.<br>Use "Copy note" in NotebookLM.
      </div>`;
    return;
  }

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'item';
    el.id = `item-${item.id}`;
    
    // Create snippet
    const raw = item.plain || '';
    const snippet = raw.substring(0, 120) + (raw.length > 120 ? '...' : '');

    el.innerHTML = `
      <div class="meta">
        <div class="title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        <div class="snip">${escapeHtml(snippet)}</div>
        <div class="ts">${fmtTs(item.ts)}</div>
      </div>
      <div class="controls">
        <button class="icon-btn primary openBtn" title="Open full view" data-id="${item.id}">${ICONS.open}</button>
        <button class="icon-btn copyBtn" title="Copy to clipboard" data-id="${item.id}">${ICONS.copy}</button>
        <button class="icon-btn danger deleteBtn" title="Delete note" data-id="${item.id}">${ICONS.trash}</button>
      </div>
    `;
    list.appendChild(el);
  });

  attachHandlers();
}

function attachHandlers() {
  // Open
  document.querySelectorAll('.openBtn').forEach(b => b.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.id;
    chrome.runtime.sendMessage({ action: 'openView', id });
  }));

  // Copy
  document.querySelectorAll('.copyBtn').forEach(b => b.addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.id;
    const btn = e.currentTarget;
    
    const it = allItems.find(x => x.id === id);
    if (!it) return;

    try {
      // Reconstruct header for clipboard
      const clipHtml = `<h1>${escapeHtml(it.title)}</h1>` + it.html;
      const clipPlain = `${it.title}\n\n${it.plain}`;
      
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([clipHtml], { type: 'text/html' }),
          'text/plain': new Blob([clipPlain], { type: 'text/plain' })
        })
      ]);
      
      showToast('Copied to clipboard!');
      
      // Visual feedback on button
      const original = btn.innerHTML;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke="#1a73e8"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => btn.innerHTML = original, 1500);
      
    } catch (err) {
      showToast('Copy failed');
    }
  }));

  // Delete
  document.querySelectorAll('.deleteBtn').forEach(b => b.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.id;
    const el = document.getElementById(`item-${id}`);
    
    if (confirm('Delete this note?')) {
      // Animate out
      el.classList.add('deleting');
      
      // Remove from data after animation
      setTimeout(() => {
        allItems = allItems.filter(x => x.id !== id);
        chrome.storage.local.set({ [HISTORY_KEY]: allItems });
        renderList(allItems); // re-render to fix spacing/empty state
        showToast('Note deleted');
      }, 300);
    }
  }));
}

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const clearAll = document.getElementById('clearAll');
  const openHistoryTab = document.getElementById('openHistoryTab');

  // Load Data
  chrome.storage.local.get([HISTORY_KEY], (res) => {
    allItems = res[HISTORY_KEY] || [];
    renderList(allItems);
  });

  // Search Filter
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allItems.filter(item => 
      (item.title && item.title.toLowerCase().includes(term)) || 
      (item.plain && item.plain.toLowerCase().includes(term))
    );
    renderList(filtered);
  });

  // Clear All
  clearAll.addEventListener('click', () => {
    if (allItems.length === 0) return;
    if (confirm('Are you sure you want to delete ALL notes?')) {
      chrome.storage.local.set({ [HISTORY_KEY]: [] }, () => {
        allItems = [];
        renderList([]);
        showToast('All notes cleared');
      });
    }
  });

  // Open Full Tab
  openHistoryTab.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openView', id: null });
  });
});