# q2-expense-claims.xlsx

One sheet, `Claims`, with 25 expense claims (CL-0201 to CL-0225) from four employees, April to June 2026. Columns: Claim ID, Employee, Expense date, Submitted, Category, Description, Amount (GBP), Receipt attached, Approved by. Total 1,274.34. Six rows break the policy in `expense-policy.pdf`.

## Prompt 1

Attach this file and `expense-policy.pdf`. Prompt: `/expenses Check every claim against the policy.`

Expected findings table, each row with claim ID, rule, and values:

| Claim | Finding |
| --- | --- |
| CL-0209 | Meal 38.50 for 1 person, limit 25.00 (rule 2) |
| CL-0214 | Hotel 165.00 per night, limit 140.00 (rule 3) |
| CL-0217 | Possible duplicate of CL-0211: same employee, date 5 May 2026, description, and 31.60 (rule 7) |
| CL-0220 | 42.00 with no receipt, limit 10.00 (rule 1) |
| CL-0223 | Expense 30 April, submitted 10 June, 41 days, limit 30 (rule 5) |
| CL-0225 | 260.00 with no approver; needs Managing Director approval over 200.00 (rule 6) |

Expected checks that pass and should not be flagged as errors:

- CL-0221 is 44.00 for 2 people, 22.00 per person, within the limit.
- Mileage arithmetic is correct: 42 x 0.45 = 18.90, 60 x 0.45 = 27.00, 24 x 0.45 = 10.80.
- CL-0208 is 6.80, under the receipt threshold.

Mileage rows CL-0203, CL-0212, and CL-0222 have no receipt and are over 10.00. The policy does not exempt mileage, so the answer should list them as a check for the reviewer, not as proven violations. The total of 1,274.34 should match.

## Prompt 2

Attach the file. Prompt: `/extract all claims by Priya Shah with date, category, and amount`

Expected: 8 rows (CL-0201, 0202, 0209, 0211, 0216, 0217, 0221, 0225, and no others), total 504.30, each with its row reference. No policy judgement.
