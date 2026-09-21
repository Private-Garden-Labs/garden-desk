# sales-ledger-2026-q1/

Three XLSX sales ledgers, one per month, sheet `Invoices`. Columns: Invoice, Issue date, Customer, Net (GBP), VAT (GBP), Gross (GBP), Status, Paid date, Bank reference. Together with `bank-statements-2026-q1/` they form a reconciliation test. Four differences are planted.

| File | Rows | Gross | Paid | Open |
| --- | --- | --- | --- | --- |
| sales-ledger-2026-01-january.xlsx | 20 | 23,694.00 | 20 | 0 |
| sales-ledger-2026-02-february.xlsx | 20 | 23,592.00 | 19 | 1 (INV-2026-0139) |
| sales-ledger-2026-03-march.xlsx | 21 (one duplicate row) | 22,014.00 including the duplicate; 20,196.00 without it | 10 rows, 9 invoices | 11 |

Quarter: 60 invoices, gross 67,482.00; 48 paid (54,984.00), 12 open (12,498.00).

## Prompt 1

Select this folder only. Prompt: `/extract a list of open invoices with customer, issue date, and gross amount`

Expected: 12 invoices, total 12,498.00: INV-2026-0139 from the February file and INV-2026-0148, 0150, 0152 to 0160 from the March file. Each row cites file and row.

## Prompt 2

Select both `sales-ledger-2026-q1/` and `bank-statements-2026-q1/` (or copy both folders into one parent folder and select that). Prompt: `/reconcile the sales ledger against the bank statements for January to March 2026, matching on invoice number`

Expected: 46 invoices match exactly (51,912.00), and one exception table with these rows:

| Category | Record | Ledger | Bank | Required check |
| --- | --- | --- | --- | --- |
| Amount difference | INV-2026-0107 | 1,092.00, January file | 840.00 received 1 February | Difference 252.00 |
| Paid in ledger, no receipt | INV-2026-0115 | Paid 31 January 2026, 1,980.00 | No receipt in any statement | Confirm payment |
| Possible duplicate | INV-2026-0121 | Same row in February and March files, 1,818.00 | One receipt 13 February 1,818.00 | Remove one ledger row |
| Receipt for open invoice | INV-2026-0139 | Open, no paid date, 1,542.00 | 1,542.00 received 22 March | Update ledger status |
| Receipts not in ledger | INV-2025-0231 to 0240 (7 receipts) | Not in the Q1 files | 8,184.00 in January | Prior-period invoices |

Amounts must stay in GBP; there is no currency conversion. The answer should ask for qualified finance review and should not post or approve entries.

## Prompt 3

Select both folders. Prompt: `Which customers still owe us money at 31 March 2026, and how much each?`

Expected: the 12 open invoices grouped by customer, total 12,498.00, with INV-2026-0139 listed as open in the ledger but received in the bank on 22 March, so the customer question for that invoice is flagged, not silently resolved.
