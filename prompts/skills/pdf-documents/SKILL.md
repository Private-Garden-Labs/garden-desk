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

Platypus handles page breaks and margins. Put spacing in the style with `spaceAfter`; a trailing `Spacer` can create an empty last page. For page work, use `PdfReader` and `PdfWriter` from `pypdf`.

## Verify

Reopen the PDF you write with `PdfReader`. Assert its page count, the text of each page you generated, and that the last page has text.

## Gotchas

- Set metadata with `PdfWriter.add_metadata()` using slash-prefixed keys, for example `{"/Title": "Report"}`.
- Reopen and check page count, order, rotation, and metadata before you report the deliverable done.
- Save under `/workspace`; `/source` is read-only.
