---
name: word-documents
description: Create or edit a DOCX deliverable. Not for reading; `read` returns DOC and DOCX text.
---

## Library

Use the installed `python-docx` through `python`. Do not install packages.

## Recipe

Set the body font, size, and paragraph spacing for the reader before you add content. Do not use the default template unchanged; it is a bare default, not a finished deliverable.

```python
from docx import Document
from docx.shared import Pt

document = Document()
normal = document.styles["Normal"]
normal.font.name = "Georgia"
normal.font.size = Pt(11)
normal.paragraph_format.space_after = Pt(8)
document.add_heading("Title", level=1)
document.add_paragraph("Body text.")
table = document.add_table(rows=1, cols=2)
table.style = "Table Grid"
table.rows[0].cells[0].text = "column_a"
document.save(path)
```

To edit an existing `.docx`, load it with `Document(path)`, add or change paragraphs, table rows, or styles, then `document.save(path)`. Never create or edit a `.doc`; produce a `.docx` deliverable instead.

## Verify

Reopen every `.docx` you write with `Document(path)` and assert its paragraph or table row count matches what you intended.

## Gotchas

- A table's text lives in `table.rows`, not in `document.paragraphs`.
- Save under `/workspace`; `/source` is read-only.
