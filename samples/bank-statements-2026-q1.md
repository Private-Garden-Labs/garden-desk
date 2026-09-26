# bank-statements-2026-q1/

Three XLSX bank statements for Cedar Lane Coffee Roasters Ltd, one per month, sheet `Statement`. Columns: Date, Reference, Description, Money out (GBP), Money in (GBP), Balance (GBP). Row 2 is the opening balance. Customer receipts carry the invoice number as the reference. Payments are rent, supplier, energy, card fees, payroll, and HMRC.

| File | Rows after header | Opening | Money in | Money out | Closing |
| --- | --- | --- | --- | --- | --- |
| bank-statement-2026-01-january.xlsx | 20 | 24,180.55 | 16,470.00 | 19,515.68 | 21,134.87 |
| bank-statement-2026-02-february.xlsx | 30 | 21,134.87 | 27,684.00 | 17,380.05 | 31,438.82 |
| bank-statement-2026-03-march.xlsx | 27 | 31,438.82 | 18,324.00 | 21,387.62 | 28,375.20 |

Quarter: 55 customer receipts totalling 62,478.00; payments 58,283.35. Seven January receipts (8,184.00) reference December invoices INV-2025-0231 to INV-2025-0240.

## Prompt 1

Select the folder. Prompt: `What is in this folder and how are the files structured?`

Expected: the folder intake specialist reports three workbooks with the same `Statement` sheet and six columns, the opening balance row, the month each file covers, and that the balance column runs from one file into the next (closing 21,134.87 equals the February opening). It should say which files it inspected.

## Prompt 2

Select the folder. Prompt: `Give total money in, total money out, and closing balance for each month, then the quarter`

Expected: the table above, plus quarter totals 62,478.00 in, 58,283.35 out, closing 28,375.20. Each figure cites its file. A recalculated balance check should pass (opening plus in minus out equals closing for every file).

## Prompt 3

Select the folder. Prompt: `How much did we pay Finca Alta Trading this quarter, and when?`

Expected: three payments, 12,596.00 in total: 9 January 4,512.00 (FA-2025-0331), 11 February 3,948.00 (FA-2026-0012), 10 March 4,136.00 (FA-2026-0027), each with file and row.
