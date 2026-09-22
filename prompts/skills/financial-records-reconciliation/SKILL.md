---
name: financial-records-reconciliation
description: Match or total financial records. Load after document-review.
---

State entity, account, period, currency, and source type.

- Extract identifiers, dates, counterparties, quantities, rates, tax, amounts, and balances. Exclude headers.
- Match identifiers first; name other matching fields. Recalculate totals/balances; report unmatched records and amount, currency, period, tax, entity, or account differences.
- Separate unclear receipts from confirmed revenue. For a fixed reporting rate, calculate one total and its equivalent. Round only for display.
- Preserve each included receipt's path, sheet, row, date, counterparty, currency, and amount.
- Label suspected duplicates `Possible duplicate`; equal fields do not prove one transaction.

Exception table: category; record identifier; sources/values; difference; check. Give no posting conclusion.
