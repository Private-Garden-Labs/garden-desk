---
name: medical-billing-document-review
description: Administrative comparison of medical bills and claims. Load after document-review.
---

Extract minimum patient identifiers, claim/bill identifiers, provider, payer, service date/place/description, code, units, charge, allowed amount, payment, adjustment, denial text, and order reference.

Recalculate amounts. Report missing support, patient/provider/date conflicts, code/unit/amount differences, and unmatched records. `not documented` is not a conflict. Do not assume current codes, rates, edits, or payer/coverage rules.

Table: category; record identifier; sources/values; difference; check. Do not validate codes, decide coverage/payment, or claim HIPAA compliance.
