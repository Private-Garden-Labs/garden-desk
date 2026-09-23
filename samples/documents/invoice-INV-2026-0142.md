# invoice-INV-2026-0142.pdf

One-page supplier invoice from Finca Alta Trading S.L. to Cedar Lane Coffee Roasters Ltd, dated 12 May 2026, three lines, VAT 20%. Two errors are planted inside the invoice. Two more appear when the agreement and amendment are attached.

## Prompt 1

Attach the file. Prompt: `/expenses`

Expected findings, each with a source citation:

- Line 1: 420 kg x 9.40 = 3,948.00, but the invoice shows 3,984.00 (36.00 too high).
- Because of line 1, the subtotal should be 4,228.00 (shown 4,264.00), VAT 845.60 (shown 852.80), and total 5,073.60 (shown 5,116.80). Total is overstated by 43.20.
- Due date: 12 May 2026 plus 30 days is 11 June 2026, but the invoice shows 1 June 2026.
- Lines 2 and 3 are correct (180.00 and 40 x 2.50 = 100.00).

The answer should not say the invoice is fraudulent or approve payment.

## Prompt 2

Attach this file, `supplier-agreement-2026.docx`, and `supplier-agreement-2026-amendment-1.docx`. Prompt: `/expenses Check this invoice against the supply agreement and its amendment.`

Expected: the findings from Prompt 1, plus:

- The amendment sets GBP 9.85 per kg for orders confirmed on or after 1 May 2026. The invoice uses 9.40 and does not state the order confirmation date. Open question, not a proven error.
- The amendment requires 30 kg bags. 420 kg needs 14 bags, but 40 bags are invoiced. Open question.
- Payment terms of 30 days match clause 5.1.

## Prompt 3

Attach the file. Prompt: `/review`

Expected: the arithmetic error on line 1 and the due date error, cited with page 1 line numbers, plus the PDF extraction limit (no images, no reading order guarantee).
