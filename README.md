# Docyard — Document Toolkit (Static, Vercel-ready)

Convert, merge, split, and compress PDFs and Office documents — entirely in the browser. No server, no Docker, no API keys, no file ever leaves the visitor's device.

## Tools included

**Convert to PDF:** Word (.docx), PowerPoint (.pptx), Excel (.xlsx/.xls), JPG/PNG, HTML
**Convert from PDF:** JPG, Word, PowerPoint, Excel
**Organize & compress:** Merge PDF, Split PDF, Compress PDF, Compress Image

## Why this is deployable on Vercel with zero config

There's no backend. Everything runs client-side using WebAssembly/JS libraries loaded from a CDN:

| Library | Used for |
|---|---|
| [pdf-lib](https://pdf-lib.js.org/) | Create, merge, split, and re-save PDFs |
| [pdf.js](https://mozilla.github.io/pdf.js/) | Render PDF pages to canvas / extract text |
| [mammoth.js](https://github.com/mwilliamson/mammoth.js) | Read .docx into HTML |
| [SheetJS (xlsx)](https://sheetjs.com/) | Read/write .xlsx and .xls |
| [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) | Render HTML to a PDF |
| [pptxgenjs](https://gitbrent.github.io/PptxGenJS/) | Build .pptx files |
| [JSZip](https://stuk.github.io/jszip/) | Read/write .zip and .pptx/.docx container formats |

Since the whole site is static HTML/CSS/JS, it deploys the same way on Vercel, Netlify, GitHub Pages, or literally any static host.

## Fidelity — read this before you promise "perfect" conversions

Browser-only conversion can't match a real Office/LibreOffice engine. Each tool in the UI shows a note about its limits, summarized here:

- **Word/Excel → PDF**: rendered via HTML, so complex layouts, tracked changes, and charts may shift.
- **PDF → Word/Excel**: text-only extraction — no layout or table reconstruction.
- **PDF → PowerPoint**: each page becomes a full-page image (looks exact, but isn't editable text).
- **PowerPoint → PDF**: text-only extraction from slide XML — images and layout aren't reproduced.
- **Compress PDF (Strong mode)**: rasterizes pages to JPEG, which shrinks file size a lot but removes selectable text.

If you outgrow these limits later, the fix is a small server-side conversion service (e.g. a container running LibreOffice, deployed separately on Railway/Render/Fly) that this frontend calls — but that's a deliberate future upgrade, not something this deployment needs.

## Deploy to GitHub + Vercel

**1. Push to GitHub**
```bash
cd docyard-static
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

**2. Import into Vercel**
- Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo.
- Framework preset: choose **"Other"** (it's a static site — no build command, no output directory needed).
- Click **Deploy**. That's it — Vercel serves `index.html` from the repo root.

Every future `git push` to `main` auto-deploys.

## Running it locally

No build step needed. Any static file server works:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed local URL.

## Project structure

```
index.html    Page markup — tool grid + upload panel
styles.css    Design system (all colors/type as CSS custom properties)
app.js        All logic: dropzone, and every conversion engine
```

## Customizing

- Add a new tool by adding an entry to `TOOLS` in `app.js`, a matching `case` in `runActiveTool()`, a converter function, and a `<button class="tool-card">` in `index.html`.
- Colors, type, and spacing all live as CSS custom properties at the top of `styles.css`.
