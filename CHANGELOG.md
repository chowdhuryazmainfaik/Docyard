# Changelog

All notable changes to Docyard are tracked here. The current version is shown in the site footer.

## v2.2 (current)
- Fixed Word/Excel/HTML → PDF producing black or blank pages on large documents — long
  documents were exceeding the browser's maximum canvas size in a single capture; now
  captured one page at a time instead.
- Added automatic OCR fallback (Tesseract.js, loaded on demand) for PDF → Word/Excel/Text
  when a page has no embedded text layer — covers scanned PDFs and PDFs made of rendered
  page images.
- Fixed native `<select>` dropdown options rendering unreadable (white background) in dark
  mode.
- New tools: **Organize PDF** (drag to reorder, rotate, delete pages), **Watermark PDF**,
  **PDF to Text**.
- Updated favicon and footer logo artwork.
- Footer credit updated, version badge added.

## v2.1
- Fixed mobile header layout: the "FILES IN → FILES OUT" tagline was overlapping the logo
  at narrow widths — now hidden below 640px instead of wrapping.
- Favicon iterations to match updated brand artwork.

## v2.0
- Replaced the `html2pdf.js` wrapper with direct `html2canvas` + `jsPDF` calls for
  Word/Excel/HTML → PDF, fixing a blank leading page and non-standard margins caused by
  its automatic pagination logic.
- Fixed a black-background bug affecting PDF → JPG, PDF → PowerPoint, and Compress PDF
  (strong mode): canvas transparency was flattening to black on JPEG export instead of
  white.
- Rebuilt the minimal `.docx` writer to be spec-compliant (added `styles.xml`, `docProps`,
  `fontTable.xml`) so PDF → Word output opens cleanly in more viewers.
- Logo and favicon updated to current artwork; light/dark theme variants generated from
  the same source art (font/shape untouched, only recolored where needed for contrast).
- Dark/light theme toggle, default theme set to light.
- Liquid-glass visual redesign (blurred background mesh, glass panels).

## v1.0
- Initial release: fully client-side document toolkit (no server, deployable as a static
  site to Vercel/GitHub Pages).
- Convert to PDF: Word, PowerPoint, Excel, JPG/PNG, HTML.
- Convert from PDF: JPG, Word, PowerPoint, Excel.
- Organize & compress: Merge PDF, Split PDF, Compress PDF, Compress Image.
