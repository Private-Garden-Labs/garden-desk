---
name: pdf-documents
description: Create a PDF deliverable or split, merge, and rotate pages. Not for reading; `read` returns PDF text with page markers.
---

## Library

Use the installed `pypdf` through `python` for page work, and `reportlab` (Platypus) to create a PDF. Do not install packages.

## Recipe

```python
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table
from reportlab.lib.styles import getSampleStyleSheet

styles = getSampleStyleSheet()
SimpleDocTemplate(path, pagesize=A4).build([
    Paragraph("Title", styles["Heading1"]),
    Paragraph("Body text.", styles["BodyText"]),
    Table([["column_a", "column_b"], ["1", "2"]]),
])
```

Platypus handles page breaks and margins. For page work, use `PdfReader` and `PdfWriter` from `pypdf`.

## Verify

Reopen the PDF you write with `PdfReader` and assert its page count and the text of each page you generated.

## Gotchas

- Set metadata with `PdfWriter.add_metadata()` using slash-prefixed keys, for example `{"/Title": "Report"}`.
- Reopen and check page count, order, rotation, and metadata before you report the deliverable done.
- Save under `/workspace`; `/source` is read-only.
