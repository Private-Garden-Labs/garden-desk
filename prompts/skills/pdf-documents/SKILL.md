---
name: pdf-documents
description: Create PDFs or change pages. Use read for PDF text.
---

Use ReportLab Platypus for text PDFs. Adapt this recipe; let paragraphs flow across pages.

```python
from xml.sax.saxutils import escape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate

pdfmetrics.registerFont(TTFont("Body", "/usr/share/fonts/dejavu/DejaVuSerif.ttf"))
title = ParagraphStyle("title", fontName="Body", fontSize=22, leading=28, spaceAfter=16)
body = ParagraphStyle("body", fontName="Body", fontSize=12, leading=18, spaceAfter=10)
paragraphs = ["Body text."]
path = "/workspace/result.pdf"
story = [Paragraph(escape("Title"), title)]
story += [Paragraph(escape(text), body) for text in paragraphs]
SimpleDocTemplate(path, title="Title").build(story)
```

- Add tables only when needed. Set `colWidths`/`rowHeights` in `Table(...)`; let row heights grow with text. On `LayoutError`, split oversized content.
- For Chinese/Japanese/Korean, use `TTFont("Body", "/usr/share/fonts/wqy-zenhei/wqy-zenhei.ttc", subfontIndex=0)`. This runtime lacks shaping support for Arabic, Hebrew, Devanagari, and Thai; explain the limit and offer DOCX.
- Use `pypdf.PdfReader`/`PdfWriter` to split, merge, or rotate pages.

Reopen with `PdfReader(path)`; compare page count and `page.extract_text()` with the request. Return after a successful check. Never decode PDF streams manually.
