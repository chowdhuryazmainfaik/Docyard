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
    note: 'Text-only extraction — layout, images, and tables are not reconstructed.' },
  'pdf-to-ppt':    { title: 'PDF to PowerPoint', accept: '.pdf',                  hint: 'Accepts .pdf',
    note: 'Each page becomes a full-slide image, so visuals are preserved exactly — but text on the slide is not editable.' },
  'pdf-to-excel':  { title: 'PDF to Excel',      accept: '.pdf',                  hint: 'Accepts .pdf',
    note: 'Extracts text line by line into column A — this is not real table/column detection.' },
  'merge-pdf':     { title: 'Merge PDF',         accept: '.pdf', multiple: true,  hint: 'Add two or more PDFs, in the order you want them joined' },
  'split-pdf':     { title: 'Split PDF',         accept: '.pdf',                  hint: 'Accepts a single .pdf — every page is returned as a separate file in a .zip' },
  'compress-pdf':  { title: 'Compress PDF',      accept: '.pdf',                  hint: 'Accepts .pdf',
    note: 'Light mode re-packs the file losslessly. Strong mode rasterizes each page as a JPEG — much smaller, but text is no longer selectable.' },
  'compress-image':{ title: 'Compress Image',    accept: '.jpg,.jpeg,.png,.webp', hint: 'Accepts .jpg, .png or .webp' },
};

let activeTool = null;
let files = [];

const bench = document.getElementById('bench-generic');
const benchTitle = document.getElementById('bench-title');
const benchNote = document.getElementById('bench-note');
const dropzone = document.getElementById('dropzone');
const dropzoneHint = document.getElementById('dropzone-hint');
const fileInput = document.getElementById('file-input');
const fileListEl = document.getElementById('file-list');
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
}

function removeFile(idx) {
  files.splice(idx, 1);
  renderFileList();
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
  }
}

function updateRunButton() {
  const t = TOOLS[activeTool];
  const min = activeTool === 'merge-pdf' ? 2 : 1;
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
    'pdf-to-jpg': 'Convert to JPG',
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
// CSS leaking into the capture. Pagination is computed manually (slice the captured
// canvas ourselves and place each slice on its own A4 page) instead of relying on a
// wrapper library's automatic page-break logic, which was producing a blank leading
// page and non-standard margins.
function renderStandaloneHtmlToPdf(srcdoc, filename) {
  return new Promise((resolve, reject) => {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      return reject(new Error('The PDF renderer failed to load — check your connection and reload the page.'));
    }
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#e9ebef;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:40px 0;';
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
      showProgress(50);
      // Wait for the iframe to actually paint (fonts/layout settled) before capturing —
      // this is what was causing partial/faded first-page captures previously.
      requestAnimationFrame(() => requestAnimationFrame(async () => {
        try {
          const body = iframe.contentDocument.body;
          const fullHeight = Math.max(body.scrollHeight, body.offsetHeight);
          const canvas = await html2canvas(body, {
            scale: 2, useCORS: true, backgroundColor: '#ffffff',
            width: body.scrollWidth, height: fullHeight, windowWidth: body.scrollWidth, windowHeight: fullHeight,
          });
          showProgress(80);

          const { jsPDF } = window.jspdf;
          const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const margin = 28;
          const usableW = pageW - margin * 2;
          const usableH = pageH - margin * 2;
          const ptPerPx = usableW / canvas.width;
          const pageSlicePx = usableH / ptPerPx;

          const ctx = canvas.getContext('2d');
          // Find a blank (near-white) row near the ideal break point so we don't slice
          // straight through a line of text — search backward up to ~10% of a page height.
          function findSafeBreak(idealY) {
            const maxSearch = Math.min(pageSlicePx * 0.35, 300);
            const minY = Math.max(1, Math.floor(idealY - maxSearch));
            for (let y = Math.floor(idealY); y > minY; y--) {
              const row = ctx.getImageData(0, y, canvas.width, 1).data;
              let blank = true;
              for (let x = 0; x < row.length; x += 4 * 6) { // sample every 6th pixel for speed
                if (row[x] < 250 || row[x + 1] < 250 || row[x + 2] < 250) { blank = false; break; }
              }
              if (blank) return y;
            }
            return Math.floor(idealY); // fall back to the exact math boundary if nothing found
          }

          let renderedPx = 0;
          let first = true;
          while (renderedPx < canvas.height) {
            const idealEnd = renderedPx + pageSlicePx;
            const sliceEnd = idealEnd >= canvas.height ? canvas.height : findSafeBreak(idealEnd);
            const sliceHeightPx = Math.max(1, sliceEnd - renderedPx);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeightPx;
            sliceCanvas.getContext('2d').drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
            const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
            if (!first) pdf.addPage();
            pdf.addImage(sliceData, 'JPEG', margin, margin, usableW, sliceHeightPx * ptPerPx);
            renderedPx += sliceHeightPx;
            first = false;
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

// ---------- PDF -> Word (text only, minimal .docx) ----------
async function runPdfToWord() {
  const file = files[0];
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const paragraphs = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    groupTextItemsIntoLines(content.items).forEach(l => paragraphs.push(l));
    paragraphs.push('');
    showProgress(15 + (70 * i) / pdf.numPages);
  }
  const zipBytes = await buildMinimalDocx(paragraphs.length ? paragraphs : ['']);
  downloadBlob(new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), file.name.replace(/\.pdf$/i, '') + '.docx');
}

// ---------- PDF -> Excel (text lines, no table detection) ----------
async function runPdfToExcel() {
  const file = files[0];
  const bytes = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const rows = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    groupTextItemsIntoLines(content.items).forEach(l => rows.push([l]));
    showProgress(15 + (70 * i) / pdf.numPages);
  }
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
