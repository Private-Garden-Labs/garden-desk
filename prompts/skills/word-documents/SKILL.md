---
name: word-documents
description: Create or edit DOCX. Use read for DOC/DOCX text.
---

Use `python-docx`; output DOCX, never DOC.

```python
from docx import Document

doc = Document()  # Document(path) to edit
doc.add_heading("Title", 0)
doc.add_paragraph("Body text.")
path = "/workspace/result.docx"
doc.save(path)
```

Reopen with `Document(path)`; compare content with the request. Check tables in `doc.tables` separately from `doc.paragraphs`. Return after a successful check.
