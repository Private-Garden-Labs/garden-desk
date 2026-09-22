---
name: pdf-documents
description: Create a PDF deliverable or split, merge, and rotate pages. Not for reading; `read` returns PDF text with page markers.
---

## Library

Use the installed `pypdf` through `python` for page work, and `reportlab` (Platypus) to create a PDF. Do not install packages.

## Recipe

Choose the fonts, sizes, spacing, alignment, and margins for the reader before you write. Do not use the stock stylesheet unchanged; it is a bare default, not a finished deliverable.

```python
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table

base = getSampleStyleSheet()
title = ParagraphStyle("title", parent=base["Title"], fontName="Times-Bold", fontSize=24, leading=28, spaceAfter=14)
body = ParagraphStyle("body", parent=base["Normal"], fontName="Times-Roman", fontSize=11.5, leading=17, alignment=TA_JUSTIFY, spaceAfter=10)
SimpleDocTemplate(path, pagesize=A4, leftMargin=inch, rightMargin=inch, topMargin=inch, bottomMargin=inch, title="Title").build([
    Paragraph("Title", title),
    Paragraph("Body text.", body),
    Table([["column_a", "column_b"], ["1", "2"]]),
])
```

Platypus handles page breaks and margins. For page work, use `PdfReader` and `PdfWriter` from `pypdf`.

## Fonts

The built-in Times, Helvetica, and Courier fonts and the bundled Vera font cover only basic Latin. For any other text, register a TrueType font from `/usr/share/fonts` and set `fontName` to it in every style. Register a bold or italic file the same way when you use it.

```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont("DejaVuSerif", "/usr/share/fonts/dejavu/DejaVuSerif.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuSerif-Bold", "/usr/share/fonts/dejavu/DejaVuSerif-Bold.ttf"))
```

| Text | Font | Files |
| --- | --- | --- |
| Latin with diacritics (Romanian, Polish, Czech, Turkish, Vietnamese), Cyrillic, Greek, Armenian, Georgian | DejaVu Serif for reading, DejaVu Sans for headings and tables, DejaVu Sans Mono for code | `/usr/share/fonts/dejavu/DejaVuSans.ttf`, `DejaVuSans-Bold.ttf`, `DejaVuSans-Oblique.ttf`, `DejaVuSerif.ttf`, `DejaVuSerif-Bold.ttf`, `DejaVuSerif-Italic.ttf`, `DejaVuSansMono.ttf` |
| Chinese, Japanese, Korean | WenQuanYi Zen Hei (one weight) | `TTFont("WenQuanYi", "/usr/share/fonts/wqy-zenhei/wqy-zenhei.ttc", subfontIndex=0)` |
| Arabic, Hebrew, Devanagari, Thai, and other right-to-left or shaped scripts | Not supported: ReportLab does no shaping or right-to-left layout | Deliver DOCX with `word-documents` instead |

For mixed text, register both fonts and switch with `<font name="WenQuanYi">…</font>` inside a paragraph.

## Verify

Reopen the PDF you write with `PdfReader` and assert its page count and the text of each page you generated.

## Gotchas

- Set metadata with `PdfWriter.add_metadata()` using slash-prefixed keys, for example `{"/Title": "Report"}`.
- Reopen and check page count, order, rotation, and metadata before you report the deliverable done.
- Save under `/workspace`; `/source` is read-only.
