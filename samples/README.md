# Sample documents for manual testing

Realistic files for a person to test Garden Desk in the real app. All files describe one imaginary company, Cedar Lane Coffee Roasters Ltd (Bristol, GBP, VAT 20%). Every planted error is listed in the matching test file, so a tester can check the result.

## Layout

| Path | Content | Test file |
| --- | --- | --- |
| `documents/` | Single documents: DOCX, DOC, PDF, XLSX | One `.md` next to each document with the same name |
| `bank-statements-2026-q1/` | Three XLSX bank statements, January to March 2026 | `bank-statements-2026-q1.md` |
| `sales-ledger-2026-q1/` | Three XLSX sales ledgers for the same quarter | `sales-ledger-2026-q1.md` |
| `matter-2026-014-water-damage/` | DOCX, TXT, and CSV records of one legal matter | `matter-2026-014-water-damage.md` |

## How to test

1. Open Garden Desk and select the file, or the folder, named in the test file.
2. Type the prompt as written. Commands start with `/` (`/review`, `/obligations`, `/expenses`, `/extract`, `/reconcile`, `/brief`). Prompts without a command go to the general agent, which selects a specialist.
3. Compare the answer with the expected result. The model can use different words. Check that the facts, the amounts, and the citations are correct.

Folder test files are stored next to their folder, not inside it, so the answers are not visible to the model. The `.md` files in `documents/` are visible if you select that whole folder; select single files there.

The bank and ledger workbooks hold values only, no formulas.
