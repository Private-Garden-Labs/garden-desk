---
name: xlsx-workbooks
description: Load before reading or writing XLSX.
---

Use `openpyxl`.

```python
from openpyxl import Workbook, load_workbook

book = load_workbook(path, data_only=True)
for number, row in enumerate(book["Sheet1"].iter_rows(values_only=True), 1):
    ...

out = Workbook()
out.active.append(["column_a", "column_b"])
out.save("/workspace/result.xlsx")
```

- Avoid `read_only=True`; some exports return empty cells.
- `data_only=True` reads cached formula values, which can be absent or stale. Edit with `data_only=False` to preserve formulas.
- openpyxl does not calculate formulas. Write calculated values when numbers are required.
- Find headers by content; check row length before indexing.
- Cite path, sheet, and row.
- Reopen output; compare values and totals with source rows, not just counts. Return after a successful check.
