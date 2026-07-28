if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

// ---------- Theme toggle ----------
(function () {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('docyard-theme', next);
  });
})();

// ---------- What's New ----------
const WHATS_NEW = {
  version: '2.3.2',
  items: [
    '<b>Improved:</b> Remove Watermark now has an "Auto-detect" mode (the new default) — it reads each page\'s actual watermark color and calibrates itself, instead of you having to guess Light/Medium/Strong.',
    '<b>Added:</b> cache-busted asset URLs, so a new version always loads fresh instead of a browser or CDN potentially serving an old cached copy.',
    '<b>From v2.3.1:</b> fixed the "What\'s new" button not opening (script-ordering bug), and improved Remove Watermark to target neutral-gray pixels specifically with edge cleanup.',
    '<b>From v2.3:</b> Remove Watermark and this What\'s new panel were both introduced.',
    '<b>From v2.2:</b> fixed Word/Excel/HTML → PDF producing black or blank pages on long documents, added automatic OCR for scanned PDFs, added Organize PDF and PDF to Text, fixed unreadable dropdowns in dark mode.',
  ],
};

(function () {
  const btn = document.getElementById('whats-new-btn');
  const overlay = document.getElementById('whats-new-overlay');
  const closeBtn = document.getElementById('whats-new-close');
  const dot = document.getElementById('new-dot');
  const versionEl = document.getElementById('whats-new-version');
  const listEl = document.getElementById('whats-new-list');
  if (!btn || !overlay) return;

  versionEl.textContent = 'v' + WHATS_NEW.version;
  listEl.innerHTML = WHATS_NEW.items.map(i => `<li>${i}</li>`).join('');

  if (localStorage.getItem('docyard-seen-version') !== WHATS_NEW.version) {
    dot.classList.add('show');
  }

  function open() {
    overlay.classList.add('show');
    dot.classList.remove('show');
    localStorage.setItem('docyard-seen-version', WHATS_NEW.version);
  }
  function close() { overlay.classList.remove('show'); }

  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
})();

const TOOLS = {
  'word-to-pdf':   { title: 'Word to PDF',       accept: '.docx',                 hint: 'Accepts .docx',
    note: 'Converted via DOCX→HTML in your browser. Complex layouts, tracked changes, and embedded objects may not carry over exactly.' },
  'ppt-to-pdf':    { title: 'PowerPoint to PDF', accept: '.pptx',                 hint: 'Accepts .pptx',
    note: 'Text-only extraction from each slide — images, shapes, and positioning are not reproduced.' },
  'excel-to-pdf':  { title: 'Excel to PDF',      accept: '.xlsx,.xls',            hint: 'Accepts .xlsx or .xls',
    note: 'Each sheet is rendered as a plain HTML table — cell styling and charts are not preserved.' },
  'jpg-to-pdf':    { title: 'JPG/PNG to PDF',    accept: '.jpg,.jpeg,.png', multiple: true, hint: 'Add one or more images — combined into a single PDF in the order added' },
  'html-to-pdf':   { title: 'HTML to PDF',       accept: '.html,.htm',            hint: 'Accepts a single .html file',
    note: 'External stylesheets/scripts loaded by relative path won\'t resolve — use a self-contained HTML file for best results.' },
  'pdf-to-jpg':    { title: 'PDF to JPG',        accept: '.pdf',                  hint: 'Accepts .pdf — every page is exported as a .jpg inside a .zip' },
  'pdf-to-word':   { title: 'PDF to Word',       accept: '.pdf',                  hint: 'Accepts .pdf',
    note: 'Text-only extraction — layout, images, and tables are not reconstructed. If a page has no embedded text (e.g. a scanned page), OCR runs automatically — slower, and accuracy depends on scan quality.' },
  'pdf-to-ppt':    { title: 'PDF to PowerPoint', accept: '.pdf',                  hint: 'Accepts .pdf',
    note: 'Each page becomes a full-slide image, so visuals are preserved exactly — but text on the slide is not editable.' },
  'pdf-to-excel':  { title: 'PDF to Excel',      accept: '.pdf',                  hint: 'Accepts .pdf',
    note: 'Extracts text line by line into column A — this is not real table/column detection. OCR runs automatically on pages with no embedded text.' },
  'pdf-to-text':   { title: 'PDF to Text',       accept: '.pdf',                  hint: 'Accepts .pdf — exports a plain .txt file',
    note: 'OCR runs automatically on pages with no embedded text (e.g. scanned pages) — slower, and accuracy depends on scan quality.' },
  'merge-pdf':     { title: 'Merge PDF',         accept: '.pdf', multiple: true,  hint: 'Add two or more PDFs, in the order you want them joined' },
  'split-pdf':     { title: 'Split PDF',         accept: '.pdf',                  hint: 'Accepts a single .pdf — every page is returned as a separate file in a .zip' },
  'organize-pdf':  { title: 'Organize PDF',      accept: '.pdf',                  hint: 'Accepts a single .pdf',
    note: 'Drag a page to reorder, rotate or delete it, then save. Rendering thumbnails may take a moment for large PDFs.' },
  'watermark-pdf': { title: 'Watermark PDF',     accept: '.pdf',                  hint: 'Accepts .pdf',
    note: 'Adds a diagonal, repeating text watermark to every page.' },
  'remove-watermark': { title: 'Remove Watermark', accept: '.pdf',                hint: 'Accepts .pdf',
    note: 'Best-effort: auto-detects the watermark\'s actual color per page and whitens pale, neutral-gray, semi-transparent stamps (including this site\'s own Watermark tool), with edge cleanup to avoid ghosting. It will NOT remove solid/opaque watermarks, logos, or colored watermarks that resemble real content. Like Compress PDF\'s strong mode, this rasterizes each page, so text is no longer selectable afterward.' },
  'compress-pdf':  { title: 'Compress PDF',      accept: '.pdf',                  hint: 'Accepts .pdf',
    note: 'Light mode re-packs the file losslessly. Strong mode rasterizes each page as a JPEG — much smaller, but text is no longer selectable.' },
  'compress-image':{ title: 'Compress Image',    accept: '.jpg,.jpeg,.png,.webp', hint: 'Accepts .jpg, .png or .webp' },
};

let activeTool = null;
let files = [];
let organizePages = []; // { originalIndex, rotation, deleted, dataUrl }
let organizeReady = false;

const bench = document.getElementById('bench-generic');
const benchTitle = document.getElementById('bench-title');
const benchNote = document.getElementById('bench-note');
const dropzone = document.getElementById('dropzone');
const dropzoneHint = document.getElementById('dropzone-hint');
const fileInput = document.getElementById('file-input');
const fileListEl = document.getElementById('file-list');
const organizeGridEl = document.getElementById('organize-grid');
const optionsEl = document.getElementById('bench-options');
const runBtn = document.getElementById('run-btn');
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');

document.querySelectorAll('.tool-card').forEach(card => {
  card.addEventListener('click', () => openTool(card.dataset.tool));
});
document.getElementById('bench-close').addEventListener('click', closeBench);

function openTool(key) {
  activeTool = key;
  files = [];
  organizePages = [];
  organizeReady = false;
  organizeGridEl.innerHTML = '';
  organizeGridEl.classList.remove('show');
  const t = TOOLS[key];
  document.querySelectorAll('.tool-card').forEach(c => c.classList.toggle('active', c.dataset.tool === key));
  benchTitle.textContent = t.title;
  benchNote.textContent = t.note || '';
  dropzoneHint.textContent = t.hint;
  fileInput.accept = t.accept;
  fileInput.multiple = !!t.multiple;
  renderFileList();
  renderOptions();
  clearStatus();
  bench.classList.add('show');
  document.getElementById('workbench').scrollIntoView({ behavior: 'smooth', block: 'start' });
  updateRunButton();
}

function closeBench() {
  bench.classList.remove('show');
  document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('active'));
  activeTool = null;
  files = [];
  organizePages = [];
  organizeReady = false;
  organizeGridEl.innerHTML = '';
  organizeGridEl.classList.remove('show');
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  addFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => addFiles(fileInput.files));

function addFiles(fileListObj) {
  const t = TOOLS[activeTool];
  const incoming = Array.from(fileListObj);
  if (!t.multiple) {
    files = incoming.slice(0, 1);
  } else {
    files = files.concat(incoming);
  }
  clearStatus();
  renderFileList();
  updateRunButton();
  if (activeTool === 'organize-pdf' && files.length) {
    renderOrganizeGrid(files[0]);
  }
}

function removeFile(idx) {
  files.splice(idx, 1);
  renderFileList();
  if (activeTool === 'organize-pdf') {
    organizePages = [];
    organizeReady = false;
    organizeGridEl.innerHTML = '';
    organizeGridEl.classList.remove('show');
  }
  updateRunButton();
}

function renderFileList() {
  fileListEl.innerHTML = '';
  files.forEach((f, idx) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML = `<span class="name">📄 ${escapeHtml(f.name)} <span class="mono" style="color:var(--text-mute)">(${formatBytes(f.size)})</span></span>`;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.addEventListener('click', () => removeFile(idx));
    row.appendChild(btn);
    fileListEl.appendChild(row);
  });
}

function renderOptions() {
  optionsEl.innerHTML = '';
  if (activeTool === 'compress-pdf') {
    optionsEl.innerHTML = `
      <label for="quality">Compression level</label>
      <select id="quality">
        <option value="light" selected>Light (lossless re-pack, keeps text selectable)</option>
        <option value="strong-high">Strong — higher quality (rasterizes pages)</option>
        <option value="strong-low">Strong — smallest file (rasterizes pages)</option>
      </select>`;
  } else if (activeTool === 'compress-image') {
    optionsEl.innerHTML = `
      <label for="img-quality">Quality</label>
      <input type="range" id="img-quality" min="0.2" max="0.95" step="0.05" value="0.7">
      <span class="mono" id="img-quality-val">70%</span>
      <label for="img-scale" style="margin-left:14px">Max width</label>
      <select id="img-scale">
        <option value="0">Original</option>
        <option value="1920" selected>1920px</option>
        <option value="1280">1280px</option>
        <option value="800">800px</option>
      </select>`;
    const slider = document.getElementById('img-quality');
    slider.addEventListener('input', () => {
      document.getElementById('img-quality-val').textContent = Math.round(slider.value * 100) + '%';
    });
  } else if (activeTool === 'watermark-pdf') {
    optionsEl.innerHTML = `
      <label for="wm-text">Watermark text</label>
      <input type="text" id="wm-text" value="CONFIDENTIAL" maxlength="40" style="width:180px">
      <label for="wm-opacity" style="margin-left:14px">Opacity</label>
      <input type="range" id="wm-opacity" min="0.05" max="0.6" step="0.05" value="0.18">
      <span class="mono" id="wm-opacity-val">18%</span>`;
    const slider = document.getElementById('wm-opacity');
    slider.addEventListener('input', () => {
      document.getElementById('wm-opacity-val').textContent = Math.round(slider.value * 100) + '%';
    });
  } else if (activeTool === 'remove-watermark') {
    optionsEl.innerHTML = `
      <label for="rw-strength">Removal strength</label>
      <select id="rw-strength">
        <option value="auto" selected>Auto-detect (recommended)</option>
        <option value="210,18">Light — only very faint, near-white watermarks</option>
        <option value="225,30">Medium</option>
        <option value="236,55">Strong — catches darker watermarks too, may fade light gray content</option>
      </select>`;
  }
}

function updateRunButton() {
  const t = TOOLS[activeTool];
  const min = activeTool === 'merge-pdf' ? 2 : 1;
  if (activeTool === 'organize-pdf') {
    if (files.length >= 1 && organizeReady) {
      runBtn.disabled = false;
      runBtn.textContent = labelFor(activeTool);
    } else {
      runBtn.disabled = true;
      runBtn.textContent = files.length ? 'Preparing pages…' : 'Select a file to continue';
    }
    return;
  }
  if (files.length >= min) {
    runBtn.disabled = false;
    runBtn.textContent = labelFor(activeTool);
  } else {
    runBtn.disabled = true;
    runBtn.textContent = activeTool === 'merge-pdf' ? 'Add at least 2 PDFs' : 'Select a file to continue';
  }
}

function labelFor(key) {
  const labels = {
    'merge-pdf': 'Merge PDFs', 'split-pdf': 'Split PDF', 'compress-pdf': 'Compress PDF',
    'compress-image': 'Compress Image', 'html-to-pdf': 'Convert to PDF', 'jpg-to-pdf': 'Convert to PDF',
    'word-to-pdf': 'Convert to PDF', 'excel-to-pdf': 'Convert to PDF', 'ppt-to-pdf': 'Convert to PDF',
    'pdf-to-word': 'Convert to Word', 'pdf-to-excel': 'Convert to Excel', 'pdf-to-ppt': 'Convert to PowerPoint',
    'pdf-to-jpg': 'Convert to JPG', 'pdf-to-text': 'Convert to Text',
    'organize-pdf': 'Save PDF', 'watermark-pdf': 'Add Watermark', 'remove-watermark': 'Remove Watermark',
  };
  return labels[key] || 'Convert';
}

runBtn.addEventListener('click', runActiveTool);

async function runActiveTool() {
  runBtn.disabled = true;
  clearStatus();
  showProgress(15);
  try {
    switch (activeTool) {
      case 'merge-pdf': await runMerge(); break;
      case 'split-pdf': await runSplit(); break;
      case 'compress-image': await runCompressImage(); break;
      case 'jpg-to-pdf': await runImageToPdf(); break;
      case 'compress-pdf': await runCompressPdf(); break;
      case 'html-to-pdf': await runHtmlToPdf(); break;
      case 'word-to-pdf': await runWordToPdf(); break;
      case 'excel-to-pdf': await runExcelToPdf(); break;
      case 'pdf-to-jpg': await runPdfToJpg(); break;
      case 'pdf-to-word': await runPdfToWord(); break;
      case 'pdf-to-excel': await runPdfToExcel(); break;
      case 'pdf-to-ppt': await runPdfToPpt(); break;
      case 'ppt-to-pdf': await runPptToPdf(); break;
      case 'pdf-to-text': await runPdfToText(); break;
      case 'watermark-pdf': await runWatermarkPdf(); break;
      case 'remove-watermark': await runRemoveWatermark(); break;
      case 'organize-pdf': await runOrganizeSave(); break;
      default: throw new Error('Unknown tool.');
    }
    setStatus('Done — your download has started.', 'ok');
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Something went wrong.', 'error');
  } finally {
    hideProgress();
    runBtn.disabled = false;
  }
}

// ---------- Client-side: merge ----------
async function runMerge() {
  const { PDFDocument } = PDFLib;
  const merged = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const bytes = await files[i].arrayBuffer();
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach(p => merged.addPage(p));
    showProgress(15 + (70 * (i + 1)) / files.length);
  }
  const out = await merged.save();
  downloadBlob(new Blob([out], { type: 'application/pdf' }), 'merged.pdf');
}

// ---------- Client-side: split ----------
async function runSplit() {
  const { PDFDocument } = PDFLib;
  const bytes = await files[0].arrayBuffer();
  const src = await PDFDocument.load(bytes);
  const total = src.getPageCount();
  const zip = new JSZip();
  const baseName = files[0].name.replace(/\.pdf$/i, '');
  for (let i = 0; i < total; i++) {
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(src, [i]);
    doc.addPage(page);
    const out = await doc.save();
    zip.file(`${baseName}-page-${i + 1}.pdf`, out);
    showProgress(15 + (70 * (i + 1)) / total);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${baseName}-pages.zip`);
}

// ---------- Client-side: image compression ----------
function runCompressImage() {
  return new Promise((resolve, reject) => {
    const file = files[0];
    const quality = parseFloat(document.getElementById('img-quality').value);
    const maxWidth = parseInt(document.getElementById('img-scale').value, 10);
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    img.onload = () => {
      let w = img.width, h = img.height;
      if (maxWidth && w > maxWidth) {
        h = Math.round(h * (maxWidth / w));
        w = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      showProgress(80);
      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Compression failed.'));
        const name = file.name.replace(/\.[^.]+$/, '') + (mime === 'image/png' ? '-compressed.png' : '-compressed.jpg');
        downloadBlob(blob, name);
        resolve();
      }, mime, quality);
    };
    img.onerror = () => reject(new Error('Could not load the image.'));
    reader.readAsDataURL(file);
  });
}

// ---------- Image(s) -> PDF ----------
async function runImageToPdf() {
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const bytes = await file.arrayBuffer();
    const img = file.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    showProgress(15 + (70 * (i + 1)) / files.length);
  }
  const out = await doc.save();
  downloadBlob(new Blob([out], { type: 'application/pdf' }), 'converted.pdf');
}

// ---------- Compress PDF ----------
async function runCompressPdf() {
  const file = files[0];
  const mode = document.getElementById('quality').value;
  const bytes = await file.arrayBuffer();
  const { PDFDocument } = PDFLib;

  if (mode === 'light') {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const out = await doc.save({ useObjectStreams: true });
    showProgress(90);
    downloadBlob(new Blob([out], { type: 'application/pdf' }), 'compressed.pdf');
    return;
  }

  const quality = mode === 'strong-low' ? 0.4 : 0.65;
  const scale = mode === 'strong-low' ? 1.0 : 1.4;
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const outDoc = await PDFDocument.create();
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const jpegBytes = dataUrlToBytes(canvas.toDataURL('image/jpeg', quality));
    const img = await outDoc.embedJpg(jpegBytes);
    const pg = outDoc.addPage([viewport.width, viewport.height]);
    pg.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    showProgress(15 + (70 * i) / pdf.numPages);
  }
  const out = await outDoc.save();
  downloadBlob(new Blob([out], { type: 'application/pdf' }), 'compressed.pdf');
}

// ---------- Shared renderer: visible, style-isolated iframe -> paginated PDF ----------
// Rendered fully on-screen (not hidden) inside its own iframe document, so html2canvas
// never has to deal with off-screen positioning or our site's own backdrop-filter/blur
// CSS leaking into the capture.
//
// Captures happen ONE PAGE AT A TIME through a small clipped/shifted window, rather than
// one giant canvas for the whole document. Browsers silently fail (blank/black/corrupt
// output) once a canvas exceeds their internal size limit — a 35-page Word document at
// 2x scale can easily need a 30,000+ px tall canvas, well past that limit. Capturing a
// canvas only ~1 page tall at a time keeps every single capture small regardless of how
// long the source document is.
//
// Page-break points are found by measuring real DOM element boundaries (paragraphs, list
// items, table rows) near each ideal break, so a break lands between elements rather than
// through the middle of one — cheap DOM geometry, no pixel scanning needed.
function renderStandaloneHtmlToPdf(srcdoc, filename) {
  return new Promise((resolve, reject) => {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      return reject(new Error('The PDF renderer failed to load — check your connection and reload the page.'));
    }
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#e9ebef;display:flex;align-items:flex-start;justify-content:center;overflow:hidden;padding:40px 0;';
    const badge = document.createElement('div');
    badge.textContent = 'Preparing your PDF…';
    badge.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#14161d;color:#fff;padding:8px 18px;border-radius:999px;font:600 13px sans-serif;z-index:100000;box-shadow:0 6px 20px rgba(0,0,0,0.25);';
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:800px;height:1131px;border:0;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,0.15);';

    document.body.appendChild(overlay);
    overlay.appendChild(iframe);
    document.body.appendChild(badge);
    const cleanup = () => { overlay.remove(); badge.remove(); };

    iframe.onload = () => {
      showProgress(35);
      // Wait for the iframe to actually paint (fonts/layout settled) before measuring/capturing.
      requestAnimationFrame(() => requestAnimationFrame(async () => {
        try {
          const doc = iframe.contentDocument;
          const body = doc.body;

          // Move all of body's content into a shift wrapper, inside a clip wrapper, so we
          // can render exactly one page-tall window of content at a time.
          const shiftWrap = doc.createElement('div');
          while (body.firstChild) shiftWrap.appendChild(body.firstChild);
          const clipWrap = doc.createElement('div');
          clipWrap.style.overflow = 'hidden';
          clipWrap.appendChild(shiftWrap);
          body.appendChild(clipWrap);
          body.style.margin = '0';

          const bodyWidth = body.clientWidth || 800;
          const fullHeight = shiftWrap.scrollHeight;

          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const margin = 28;
          const usableW = pageW - margin * 2;
          const usableH = pageH - margin * 2;
          const ptPerPx = usableW / bodyWidth;
          const pageSliceCss = usableH / ptPerPx;

          // Candidate break points: bottom edge of each block-level element, relative to
          // shiftWrap's own top.
          const wrapTop = shiftWrap.getBoundingClientRect().top;
          const candidates = Array.from(shiftWrap.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, tr, div, td, th, img'))
            .map(el => el.getBoundingClientRect().bottom - wrapTop)
            .filter(y => y > 0 && y <= fullHeight)
            .sort((a, b) => a - b);

          function findBreak(idealEnd) {
            const searchMin = Math.max(0, idealEnd - Math.min(pageSliceCss * 0.35, 220));
            let best = null;
            for (const y of candidates) {
              if (y > idealEnd) break;
              if (y >= searchMin) best = y;
            }
            return best || idealEnd;
          }

          const breaks = [];
          let cursor = 0;
          while (cursor < fullHeight) {
            const idealEnd = cursor + pageSliceCss;
            const end = idealEnd >= fullHeight ? fullHeight : findBreak(idealEnd);
            breaks.push([cursor, Math.max(end, cursor + 1)]);
            cursor = end;
          }

          for (let i = 0; i < breaks.length; i++) {
            const [start, end] = breaks[i];
            const sliceHeight = end - start;
            clipWrap.style.width = bodyWidth + 'px';
            clipWrap.style.height = sliceHeight + 'px';
            shiftWrap.style.transform = `translateY(${-start}px)`;

            const canvas = await html2canvas(clipWrap, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const sliceData = canvas.toDataURL('image/jpeg', 0.92);
            if (i > 0) pdf.addPage();
            pdf.addImage(sliceData, 'JPEG', margin, margin, usableW, sliceHeight * ptPerPx);
            showProgress(15 + (75 * (i + 1)) / breaks.length);
          }

          pdf.save(filename);
          cleanup();
          resolve();
        } catch (err) {
          cleanup();
          reject(new Error('Rendering failed: ' + (err.message || err)));
        }
      }));
    };
    iframe.srcdoc = srcdoc;
  });
}

// ---------- HTML -> PDF ----------
async function runHtmlToPdf() {
  const file = files[0];
  const text = await file.text();
  await renderStandaloneHtmlToPdf(text, file.name.replace(/\.html?$/i, '') + '.pdf');
}

// ---------- Word -> PDF ----------
async function runWordToPdf() {
  const file = files[0];
  if (typeof mammoth === 'undefined') throw new Error('The Word reader failed to load — check your connection and reload the page.');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  showProgress(35);
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html, body { margin:0; padding:0; }
    body { padding:28px; font-family:Arial,Helvetica,sans-serif; color:#111; background:#fff; line-height:1.55; }
    img { max-width:100%; }
    table { border-collapse:collapse; }
    p { margin:0 0 10px; }
  </style></head><body>${result.value}</body></html>`;
  await renderStandaloneHtmlToPdf(doc, file.name.replace(/\.docx$/i, '') + '.pdf');
}

// ---------- Excel -> PDF ----------
async function runExcelToPdf() {
  const file = files[0];
  if (typeof XLSX === 'undefined') throw new Error('The Excel reader failed to load — check your connection and reload the page.');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  showProgress(35);
  let body = '';
  wb.SheetNames.forEach(name => {
    const sheet = wb.Sheets[name];
    const html = XLSX.utils.sheet_to_html(sheet, { editable: false });
    body += `<h3>${escapeHtml(name)}</h3>` + html;
  });
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html, body { margin:0; padding:0; }
    body { padding:24px; font-family:Arial,Helvetica,sans-serif; color:#111; background:#fff; }
    h3 { font-family:Arial,Helvetica,sans-serif; margin:0 0 10px; }
    table { border-collapse:collapse; margin-bottom:22px; }
    td, th { border:1px solid #ccc; padding:5px 9px; font-size:12px; white-space:nowrap; }
  </style></head><body>${body}</body></html>`;
  await renderStandaloneHtmlToPdf(doc, file.name.replace(/\.xlsx?$/i, '') + '.pdf');
}

// ---------- PDF -> JPG (zip) ----------
async function runPdfToJpg() {
  const file = files[0];
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const zip = new JSZip();
  const baseName = file.name.replace(/\.pdf$/i, '');
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    zip.file(`${baseName}-page-${i}.jpg`, dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.9)));
    showProgress(15 + (70 * i) / pdf.numPages);
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), `${baseName}-images.zip`);
}

// ---------- OCR fallback (for PDFs with no embedded text layer) ----------
// Tesseract.js is loaded on demand, not up front, since most PDFs already have real
// text and never need it. Triggered automatically when a page's text layer is empty
// (e.g. a scanned document, or a PDF built by rasterizing pages into images).
let tesseractLoadPromise = null;
function ensureTesseract() {
  if (typeof Tesseract !== 'undefined') return Promise.resolve();
  if (tesseractLoadPromise) return tesseractLoadPromise;
  tesseractLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = () => resolve();
    s.onerror = () => {
      tesseractLoadPromise = null;
      const s2 = document.createElement('script');
      s2.src = 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js';
      s2.onload = () => resolve();
      s2.onerror = () => reject(new Error('Could not load the OCR engine — check your connection.'));
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  });
  return tesseractLoadPromise;
}

async function ocrPage(worker, page) {
  const viewport = page.getViewport({ scale: 2.2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const { data } = await worker.recognize(canvas);
  return (data.text || '').split('\n').map(l => l.trim()).filter(Boolean);
}

// Extracts every page's text as an array of line-arrays, running OCR automatically
// on any page whose embedded text layer is empty or near-empty. Returns
// { pages: [[line, line, ...], ...], usedOcr: boolean }.
async function extractAllPageLines(pdf, onProgress) {
  const pages = [];
  let worker = null;
  let usedOcr = false;
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let lines = groupTextItemsIntoLines(content.items);
      if (lines.join(' ').trim().length < 3) {
        if (!worker) {
          setStatus('No embedded text found — running OCR (this can take a while for long documents)…');
          await ensureTesseract();
          worker = await Tesseract.createWorker('eng');
        }
        usedOcr = true;
        lines = await ocrPage(worker, page);
      }
      pages.push(lines);
      if (onProgress) onProgress(i, pdf.numPages);
    }
  } finally {
    if (worker) await worker.terminate();
  }
  return { pages, usedOcr };
}

// ---------- PDF -> Text ----------
async function runPdfToText() {
  const file = files[0];
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const { pages } = await extractAllPageLines(pdf, (i, total) => showProgress(15 + (70 * i) / total));
  const lines = [];
  pages.forEach(pageLines => { pageLines.forEach(l => lines.push(l)); lines.push(''); });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + '.txt');
}

// ---------- Watermark PDF ----------
async function runWatermarkPdf() {
  const file = files[0];
  const text = (document.getElementById('wm-text').value || 'CONFIDENTIAL').trim();
  const opacity = parseFloat(document.getElementById('wm-opacity').value);
  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const fontSize = Math.max(24, Math.min(width, height) * 0.09);
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const stepX = textWidth + 80;
    const stepY = fontSize * 4;
    for (let y = -height; y < height * 2; y += stepY) {
      for (let x = -width; x < width * 2; x += stepX) {
        page.drawText(text, {
          x, y, size: fontSize, font, color: rgb(0.4, 0.4, 0.4),
          opacity, rotate: degrees(-35),
        });
      }
    }
    showProgress(15 + (70 * (i + 1)) / pages.length);
  });
  const out = await doc.save();
  downloadBlob(new Blob([out], { type: 'application/pdf' }), file.name.replace(/\.pdf$/i, '') + '-watermarked.pdf');
}

// ---------- Remove Watermark (best-effort: whiten pale/semi-transparent stamps) ----------
// This targets neutral-gray, washed-out pixels — not just "any light pixel" — which is
// what a typical semi-transparent stamped watermark looks like once blended over a white
// page. Requiring near-equal R/G/B (not just high brightness) means it's far less likely
// to also erase light-colored real content like a pale highlight or a light table header,
// which only checking brightness would do. A second pass then relaxes the criteria
// slightly around pixels already marked, to clean up the faint anti-aliased edge halo
// that's otherwise left behind around removed watermark text.
//
// "Auto-detect" builds a histogram of near-neutral, non-white, non-black pixel lightness
// values for the page and finds the dominant peak — that peak is almost always the
// watermark's actual blended color, so the threshold is calibrated to what's really on
// THIS page instead of a guessed preset. Falls back to the Medium preset if no clear
// peak is found (e.g. the page has no watermark at all), so it won't over-aggressively
// alter a clean page.
//
// This is still a brightness/neutrality filter, not real watermark detection — it can't
// identify or remove a solid, opaque watermark or a logo, since there's no way to tell
// that apart from real content by color alone.
function detectWatermarkThreshold(d, w, h) {
  const buckets = new Array(256).fill(0);
  const step = 4 * 7; // sample every 7th pixel for speed
  let sampled = 0;
  for (let p = 0; p < d.length; p += step) {
    const r = d[p], g = d[p + 1], b = d[p + 2];
    const lightness = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    sampled++;
    if (spread <= 40 && lightness > 120 && lightness < 253) {
      buckets[Math.round(lightness)]++;
    }
  }
  let peak = -1, peakCount = 0;
  for (let v = 0; v < 256; v++) {
    if (buckets[v] > peakCount) { peakCount = buckets[v]; peak = v; }
  }
  // Require the peak to cover a meaningful share of sampled pixels before trusting it —
  // otherwise it's just noise, not a real repeated watermark color.
  if (peak < 0 || peakCount < sampled * 0.01) return { threshold: 225, tolerance: 30 };
  return { threshold: Math.max(120, peak - 10), tolerance: 35 };
}

async function runRemoveWatermark() {
  const file = files[0];
  const mode = document.getElementById('rw-strength').value;
  const manual = mode === 'auto' ? null : mode.split(',').map(n => parseInt(n, 10));
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const { PDFDocument } = PDFLib;
  const outDoc = await PDFDocument.create();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const w = canvas.width, h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    const [threshold, tolerance] = manual || (() => {
      const auto = detectWatermarkThreshold(d, w, h);
      return [auto.threshold, auto.tolerance];
    })();

    const pixelCount = w * h;
    const marked = new Uint8Array(pixelCount);

    // Pass 1: strict match — neutral gray, above the lightness threshold.
    for (let idx = 0; idx < pixelCount; idx++) {
      const p = idx * 4;
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const lightness = (r + g + b) / 3;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (lightness >= threshold && spread <= tolerance) marked[idx] = 1;
    }

    // Pass 2: relaxed match, only for pixels touching an already-marked neighbor —
    // cleans up anti-aliased edges without loosening the criteria globally.
    const relaxedThreshold = threshold - 22;
    const relaxedTolerance = tolerance + 15;
    const toWhiten = new Uint8Array(pixelCount);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (marked[idx]) { toWhiten[idx] = 1; continue; }
        const p = idx * 4;
        const r = d[p], g = d[p + 1], b = d[p + 2];
        const lightness = (r + g + b) / 3;
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        if (lightness < relaxedThreshold || spread > relaxedTolerance) continue;
        const hasMarkedNeighbor =
          (x > 0 && marked[idx - 1]) || (x < w - 1 && marked[idx + 1]) ||
          (y > 0 && marked[idx - w]) || (y < h - 1 && marked[idx + w]);
        if (hasMarkedNeighbor) toWhiten[idx] = 1;
      }
    }

    for (let idx = 0; idx < pixelCount; idx++) {
      if (toWhiten[idx]) {
        const p = idx * 4;
        d[p] = 255; d[p + 1] = 255; d[p + 2] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const jpegBytes = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92));
    const img = await outDoc.embedJpg(jpegBytes);
    const pg = outDoc.addPage([viewport.width, viewport.height]);
    pg.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    showProgress(15 + (70 * i) / pdf.numPages);
  }
  const outBytes = await outDoc.save();
  downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), file.name.replace(/\.pdf$/i, '') + '-cleaned.pdf');
}

// ---------- Organize PDF: render thumbnails ----------
async function renderOrganizeGrid(file) {
  organizePages = [];
  organizeReady = false;
  updateRunButton();
  organizeGridEl.innerHTML = '<p class="small" style="color:var(--text-mute)">Rendering pages…</p>';
  organizeGridEl.classList.add('show');
  try {
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      pages.push({ originalIndex: i - 1, rotation: 0, deleted: false, dataUrl: canvas.toDataURL('image/jpeg', 0.75) });
      showProgress(10 + (60 * i) / pdf.numPages);
    }
    organizePages = pages;
    organizeReady = true;
    drawOrganizeGrid();
  } catch (err) {
    organizeGridEl.innerHTML = '';
    organizeGridEl.classList.remove('show');
    setStatus('Could not read this PDF: ' + (err.message || err), 'error');
  }
  updateRunButton();
  hideProgress();
}

function drawOrganizeGrid() {
  organizeGridEl.innerHTML = '';
  organizePages.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'organize-card' + (p.deleted ? ' deleted' : '');
    card.draggable = true;
    card.dataset.idx = idx;

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'thumb-wrap';
    const img = document.createElement('img');
    img.src = p.dataUrl;
    img.style.transform = `rotate(${p.rotation}deg)`;
    thumbWrap.appendChild(img);

    const pageNum = document.createElement('div');
    pageNum.className = 'page-num';
    pageNum.textContent = 'Page ' + (p.originalIndex + 1);

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const rotateBtn = document.createElement('button');
    rotateBtn.type = 'button';
    rotateBtn.title = 'Rotate 90°';
    rotateBtn.textContent = '⟳';
    rotateBtn.addEventListener('click', () => { p.rotation = (p.rotation + 90) % 360; drawOrganizeGrid(); });
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.title = p.deleted ? 'Restore page' : 'Delete page';
    deleteBtn.textContent = p.deleted ? '↺' : '✕';
    deleteBtn.addEventListener('click', () => { p.deleted = !p.deleted; drawOrganizeGrid(); });
    actions.appendChild(rotateBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(thumbWrap);
    card.appendChild(pageNum);
    card.appendChild(actions);

    card.addEventListener('dragstart', () => { card.classList.add('dragging'); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); });
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const fromIdx = parseInt(document.querySelector('.organize-card.dragging').dataset.idx, 10);
      const toIdx = idx;
      if (fromIdx === toIdx) return;
      const [moved] = organizePages.splice(fromIdx, 1);
      organizePages.splice(toIdx, 0, moved);
      drawOrganizeGrid();
    });

    organizeGridEl.appendChild(card);
  });
}

async function runOrganizeSave() {
  const file = files[0];
  const remaining = organizePages.filter(p => !p.deleted);
  if (!remaining.length) throw new Error('At least one page must remain.');
  const { PDFDocument, degrees } = PDFLib;
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes);
  const out = await PDFDocument.create();
  for (let i = 0; i < remaining.length; i++) {
    const [page] = await out.copyPages(src, [remaining[i].originalIndex]);
    if (remaining[i].rotation) {
      const current = page.getRotation().angle || 0;
      page.setRotation(degrees(current + remaining[i].rotation));
    }
    out.addPage(page);
    showProgress(15 + (70 * (i + 1)) / remaining.length);
  }
  const outBytes = await out.save();
  downloadBlob(new Blob([outBytes], { type: 'application/pdf' }), file.name.replace(/\.pdf$/i, '') + '-organized.pdf');
}

// ---------- PDF -> Word (text only, minimal .docx) ----------
async function runPdfToWord() {
  const file = files[0];
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const { pages } = await extractAllPageLines(pdf, (i, total) => showProgress(15 + (70 * i) / total));
  const paragraphs = [];
  pages.forEach(pageLines => { pageLines.forEach(l => paragraphs.push(l)); paragraphs.push(''); });
  const zipBytes = await buildMinimalDocx(paragraphs.length ? paragraphs : ['']);
  downloadBlob(new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), file.name.replace(/\.pdf$/i, '') + '.docx');
}

// ---------- PDF -> Excel (text lines, no table detection) ----------
async function runPdfToExcel() {
  const file = files[0];
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const { pages } = await extractAllPageLines(pdf, (i, total) => showProgress(15 + (70 * i) / total));
  const rows = [];
  pages.forEach(pageLines => pageLines.forEach(l => rows.push([l])));
  const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['']]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), file.name.replace(/\.pdf$/i, '') + '.xlsx');
}

// ---------- PDF -> PowerPoint (each page as a full-slide image) ----------
async function runPdfToPpt() {
  const file = files[0];
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'PAGE', width: 10, height: 12.94 });
  pptx.layout = 'PAGE';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const slide = pptx.addSlide();
    slide.addImage({ data: canvas.toDataURL('image/jpeg', 0.85), x: 0, y: 0, w: '100%', h: '100%' });
    showProgress(15 + (70 * i) / pdf.numPages);
  }
  await pptx.writeFile({ fileName: file.name.replace(/\.pdf$/i, '') + '.pptx' });
}

// ---------- PowerPoint -> PDF (text extracted per slide) ----------
async function runPptToPdf() {
  const file = files[0];
  if (typeof JSZip === 'undefined') throw new Error('The file reader failed to load — check your connection and reload the page.');
  let zip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch (e) {
    throw new Error('Could not open this file as a .pptx — older .ppt files aren\'t supported. Re-save it as .pptx and try again.');
  }
  const slideFiles = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/slide(\d+)\.xml/)[1]) - parseInt(b.match(/slide(\d+)\.xml/)[1]));
  if (!slideFiles.length) throw new Error('No slides found — is this a valid .pptx file?');

  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('text');
    const texts = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map(m => decodeXmlEntities(m[1])).filter(t => t.trim().length > 0);
    const page = doc.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(1, 1, 1) });
    let y = 740;
    page.drawText(`Slide ${i + 1}`, { x: 50, y, size: 11, font, color: rgb(0.55, 0.55, 0.55) });
    y -= 28;
    if (!texts.length) {
      page.drawText('(No extractable text on this slide — likely images, shapes, or a chart.)', { x: 50, y, size: 11, font, color: rgb(0.55, 0.55, 0.55) });
    }
    texts.forEach(t => {
      wrapText(t, 90).forEach(line => {
        if (y < 50) return;
        page.drawText(line, { x: 50, y, size: 13, font, color: rgb(0.06, 0.08, 0.1) });
        y -= 18;
      });
      y -= 8;
    });
    showProgress(15 + (70 * (i + 1)) / slideFiles.length);
  }
  const out = await doc.save();
  downloadBlob(new Blob([out], { type: 'application/pdf' }), file.name.replace(/\.pptx?$/i, '') + '.pdf');
}

// ---------- Minimal DOCX builder (plain paragraphs, no external lib needed) ----------
// A full set of standard OOXML parts — not just document.xml — so the file opens
// cleanly in Word, Google Docs, LibreOffice, and Office Online alike.
const DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
const DOCX_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
const DOCX_DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
</Relationships>`;
const DOCX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;
const DOCX_SETTINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>`;
const DOCX_FONT_TABLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:font w:name="Calibri"><w:family w:val="swiss"/></w:font>
</w:fonts>`;
const DOCX_CORE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:creator>Docyard</dc:creator><dc:title>Converted document</dc:title>
</cp:coreProperties>`;
const DOCX_APP = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>Docyard</Application>
</Properties>`;

function buildMinimalDocx(paragraphs) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', DOCX_CONTENT_TYPES);
  zip.file('_rels/.rels', DOCX_RELS);
  zip.file('word/_rels/document.xml.rels', DOCX_DOCUMENT_RELS);
  zip.file('word/styles.xml', DOCX_STYLES);
  zip.file('word/settings.xml', DOCX_SETTINGS);
  zip.file('word/fontTable.xml', DOCX_FONT_TABLE);
  zip.file('docProps/core.xml', DOCX_CORE);
  zip.file('docProps/app.xml', DOCX_APP);
  const body = paragraphs.map(p => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`).join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
  zip.file('word/document.xml', documentXml);
  return zip.generateAsync({ type: 'uint8array' });
}

// ---------- Small helpers used above ----------
function groupTextItemsIntoLines(items) {
  const lines = [];
  let current = '';
  items.forEach(it => {
    current += it.str + (it.hasEOL ? '' : ' ');
    if (it.hasEOL) { lines.push(current.trim()); current = ''; }
  });
  if (current.trim()) lines.push(current.trim());
  return lines.filter(l => l.length > 0);
}

function decodeXmlEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function escapeXml(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function wrapText(text, maxChars) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = []; let line = '';
  words.forEach(w => {
    if ((line + ' ' + w).trim().length > maxChars) { lines.push(line.trim()); line = w; }
    else line += ' ' + w;
  });
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ---------- Helpers ----------
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}
function clearStatus() { statusEl.textContent = ''; statusEl.className = 'status'; }

function showProgress(pct) {
  progressBar.classList.add('show');
  progressFill.style.width = Math.min(pct, 100) + '%';
}
function hideProgress() {
  setTimeout(() => { progressBar.classList.remove('show'); progressFill.style.width = '0%'; }, 500);
}
