# matter-2026-014-water-damage/

Three records about one legal matter: a water leak from the landlord's bathroom into the Cedar Lane storage room in March 2026.

- `claim-letter.docx`: letter of claim dated 18 March 2026 to Harbour Row Estates Ltd, claiming 4,138.00 for 14 damaged bags (420 kg).
- `email-thread.txt`: four emails between Jonas Weber, Dana Hale (landlord), and Rita Okafor, 3 to 13 March.
- `repair-log.csv`: seven dated log entries, 2 to 16 March.

The report date of the leak differs between the three records on purpose.

## Prompt 1

Select the folder. Prompt: `Build a chronology of this matter with all sources and flag conflicting dates.`

Expected: the matter chronology specialist returns a dated table close to this:

| Date | Event | Source |
| --- | --- | --- |
| 2 Mar 2026 17:30 | Damp patch noticed on ceiling | repair-log.csv |
| 3 Mar 08:00 | Active leak found, 14 bags wet, bags moved | repair-log.csv |
| 3 Mar 08:12 | Leak reported to landlord by email | email-thread.txt, repair-log.csv |
| 5 Mar 16:40 | Landlord replies, plumber booked for 11 March | email-thread.txt |
| 6 Mar 09:15 | Photos of damaged bags, 420 kg | repair-log.csv |
| 11 Mar 14:00 | Ashton Plumbing visit, fault traced, part ordered | repair-log.csv |
| 12 Mar 10:30 | Joint replaced, leak stopped | repair-log.csv, email of 13 Mar, claim-letter.docx |
| 16 Mar 11:00 | Replacement stock ordered, 4,138.00 | repair-log.csv |
| 18 Mar | Letter of claim sent | claim-letter.docx |

Conflicts the answer must keep visible:

- Report date: the claim letter says the leak was found and reported on 2 March; the email and log show the report on 3 March at 08:12; the landlord's email of 13 March says first reported on 4 March.
- The claim letter says the leak was discovered on 2 March; the log shows only a damp patch that day and the active leak on 3 March.
- Production loss on 3 and 4 March appears only in the claim letter, with no log entry.

Coverage: the lease (clause 5.2 is cited in the letter) is not in the folder, so the repair duty is unverified.

## Prompt 2

Select the folder. Prompt: `/brief When did the landlord first know about the leak, according to each record?`

Expected: three answers with citations (2 March per the claim letter, 3 March 08:12 per the email and the log, 4 March per the landlord's email), stated as a conflict, with no decision on which is true.
