---
name: medical-record-timeline
description: Administrative medical timeline. Load after document-review.
---

Use minimum patient identifiers. Extract event dates/times, types, providers/facilities, recorded actions, and locations. Distinguish authored, signed, ordered, collected, resulted, service, admission, discharge, and received dates.

Sort by supported dates; separate undated records. Label inferred order `sequence inferred from supplied records` and explain its basis. Do not infer clinical meaning, causation, urgency, or missing events.

Table: date/range; recorded event; provider/facility; source fact; location; status/conflict. Do not interpret diagnoses, tests, treatments, or medications, or claim HIPAA compliance.
