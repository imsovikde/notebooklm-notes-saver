// view.js — render saved note, export PDF/.doc, copy, drive fallback
const HISTORY_KEY = 'nlm_history_v3';

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}
function fmtTs(ts){ try { return new Date(ts).toLocaleString(); } catch(e) { return ''; } }
function escapeHtml(s = '') {
  return s.replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 600);
}

function openPrintableWindow(htmlContent, title = 'note') {
  const w = window.open('', '_blank');
  if (!w) { alert('Pop-up blocked. Allow pop-ups for this extension to save as PDF.'); return; }
  const cssLink = '<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap" rel="stylesheet">';
  const body = `
    <html><head><meta charset='utf-8'>${cssLink}
      <style>body{font-family:Roboto, Arial, sans-serif;margin:28px;color:#111}.note{max-width:900px}</style>
    </head>
    <body>
      <div class="note">
        <h1>${escapeHtml(title)}</h1>
        ${htmlContent}
      </div>
      <script>
        setTimeout(()=>{ window.print(); }, 250);
      </script>
    </body></html>`;
  w.document.open();
  w.document.write(body);
  w.document.close();
}

document.addEventListener('DOMContentLoaded', () => {
  const id = qs('id');
  const noteEl = document.getElementById('note');
  const backBtn = document.getElementById('back');
  const copyBtn = document.getElementById('copy');
  const pdfBtn = document.getElementById('downloadPdf');
  const docBtn = document.getElementById('downloadDoc');
  const driveBtn = document.getElementById('drive');

  chrome.storage.local.get([HISTORY_KEY], (res) => {
    const list = res[HISTORY_KEY] || [];
    if (!id) {
      // show full history summary
      if (!list.length) {
        noteEl.innerHTML = '<div style="color:#666">No saved items yet.</div>';
        return;
      }
      noteEl.innerHTML = list.map(it => `
        <div style="padding:12px;border-radius:8px;margin-bottom:10px;background:#fbfbfb">
          <strong>${escapeHtml(it.title)}</strong><div style="color:#777;font-size:12px;margin-top:6px">${fmtTs(it.ts)}</div>
          <div style="margin-top:8px"><a href="${chrome.runtime.getURL('view.html')}?id=${encodeURIComponent(it.id)}">Open</a></div>
        </div>`).join('');
      return;
    }

    const item = list.find(x => x.id === id);
    if (!item) {
      noteEl.innerHTML = '<div style="color:#900">Note not found.</div>';
      return;
    }

    // render
    noteEl.innerHTML = `<h1 style="margin-top:0">${escapeHtml(item.title)}</h1>
                        <div style="color:#666;font-size:13px;margin-bottom:12px">${fmtTs(item.ts)}</div>
                        <div class="note-body">${item.html}</div>`;

    // copy
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([item.html], { type: 'text/html' }),
            'text/plain': new Blob([item.plain], { type: 'text/plain' })
          })
        ]);
        alert('Copied to clipboard');
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = item.plain || item.title || '';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        alert('Copied (fallback)');
      }
    });

    // download .doc
    docBtn.addEventListener('click', () => {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(item.title)}</title></head><body>${item.html}</body></html>`;
      const blob = new Blob([html], { type: 'application/msword' });
      downloadBlob(blob, (item.title || 'note') + '.doc');
    });

    // print -> Save as PDF
    pdfBtn.addEventListener('click', () => {
      openPrintableWindow(item.html, item.title || 'note');
    });

    driveBtn.addEventListener('click', () => {
      const ok = confirm('Direct Drive upload requires OAuth setup. Click OK to download .doc and upload manually.');
      if (ok) {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(item.title)}</title></head><body>${item.html}</body></html>`;
        const blob = new Blob([html], { type: 'application/msword' });
        downloadBlob(blob, (item.title || 'note') + '.doc');
      }
    });

    backBtn.addEventListener('click', () => history.back());
  });
});
