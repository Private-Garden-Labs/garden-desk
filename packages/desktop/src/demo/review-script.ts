import { currentLocale } from "../i18n/index.js";

export interface ReviewScript {
  prompt: string;
  sampleFile: string;
  runStarted: string;
  loadingModel: string;
  choosingAction: string;
  loadingSkill: string;
  loadedSkill: string;
  reading(path: string): string;
  read(path: string): string;
  runningCode: string;
  ranCode: string;
  executionRunning: string;
  executionFinished: string;
  responseCompleted: string;
  thinking: [string, string, string];
  readOutput: string;
  code: string;
  codeOutput: string;
  report(fileName: string): string;
}

const english: ReviewScript = {
  prompt: "Review this document",
  sampleFile: "service-agreement.pdf",
  runStarted:
    "Offline limits: live read-only source, 120 seconds per guest execution, 4 CPUs, 1 GiB memory, and a persistent 128 MiB workspace.",
  loadingModel: "Loading the local model into memory.",
  choosingAction: "Choosing the next action.",
  loadingSkill: "Loading document-review skill",
  loadedSkill: "Loaded document-review skill.",
  reading: (path) => `Reading ${path}`,
  read: (path) => `Read ${path}.`,
  runningCode: "Running code",
  ranCode: "Ran code.",
  executionRunning: "Running code.",
  executionFinished: "Finished this step.",
  responseCompleted: "Response completed.",
  thinking: [
    "The user attached one document and wants it reviewed. It looks like a services agreement, so the useful check is for internal mistakes: dates that do not add up, totals that do not match their line items, and clauses that contradict each other. I'll load the document-review skill, then read the attachment.",
    "The agreement has 8 sections. Section 2.1 starts on 1 December 2026 and runs for 12 months, but the end date is 30 November 2026. That is before the start. Section 3 has a fee table with four lines and a stated total in 3.2. Section 7 mentions the notice period twice. I'll check the dates and the arithmetic with code instead of doing them in my head.",
    "The check confirms three problems: the end date is one year early, the fee lines add up to EUR 19,700 and not EUR 18,700, and Section 7.3 says 30 days while Section 7.1 says 60. The parties, payment terms, liability cap and signatures are consistent. I'll write a short report with each mistake, where it is, and how to fix it.",
  ],
  readOutput: `exit_code: 0
termination: completed
stdout:
1: SERVICES AGREEMENT
2: No. BA-2026-114, dated 3 November 2026
3: This Services Agreement (the "Agreement") is made between:
4: Brightfield Analytics SRL, registered in Cluj-Napoca, Romania (the "Supplier"); and
5: Cedar Lane Retail Ltd, registered in Bristol, United Kingdom (the "Client").
6: 1. SERVICES
7: 1.1 The Supplier will design, build and maintain a sales reporting dashboard…`,
  code: `from datetime import date, timedelta
from decimal import Decimal

# Section 2.1: the term
start = date(2026, 12, 1)
stated_end = date(2026, 11, 30)
expected_end = date(start.year + 1, start.month, start.day) - timedelta(days=1)
print("Term end:", stated_end, "expected:", expected_end,
      "OK" if stated_end == expected_end else "MISMATCH")

# Section 3: the fee table against the stated total
lines = [Decimal("4500.00"), Decimal("9800.00"), Decimal("1200.00"), 12 * Decimal("350.00")]
stated_total = Decimal("18700.00")
print("Fee lines:", sum(lines), "stated total:", stated_total,
      "OK" if sum(lines) == stated_total else "MISMATCH")

# Section 7: the notice periods
notice_days = {"7.1": 60, "7.3": 30}
print("Notice periods:", notice_days,
      "OK" if len(set(notice_days.values())) == 1 else "MISMATCH")
`,
  codeOutput: `Term end: 2026-11-30 expected: 2027-11-30 MISMATCH
Fee lines: 19700.00 stated total: 18700.00 MISMATCH
Notice periods: {'7.1': 60, '7.3': 30} MISMATCH
`,
  report: (fileName) => `## Review of ${fileName}

I read all 8 sections and checked the dates, the amounts and the cross-references. I found **3 mistakes** to fix before anyone signs.

| # | Where | Mistake | Suggested fix |
|---|---|---|---|
| 1 | Section 2.1, Term | The agreement starts on 1 December 2026 and runs for 12 months, but it ends on **30 November 2026**, before it starts. | Change the end date to **30 November 2027**. |
| 2 | Section 3.2, Fees | The stated total is **EUR 18,700.00**, but the four fee lines add up to **EUR 19,700.00** (4,500 + 9,800 + 1,200 + 4,200). | Correct the total to EUR 19,700.00, or fix the line that is wrong. |
| 3 | Sections 7.1 and 7.3, Termination | Section 7.1 sets a notice period of **60 days**, but Section 7.3 refers to "the notice period of **30 days** set out in Section 7.1". | Use the same notice period in both clauses. |

**Checked with no issues:** party details, payment terms (30 days), late-payment interest, liability cap and signature block.

The liability cap in Section 6.1 points to the total in Section 3.2, so fixing mistake 2 also changes the cap.`,
};

const romanian: ReviewScript = {
  prompt: "Verifică acest document",
  sampleFile: "contract-prestari-servicii.pdf",
  runStarted:
    "Limite offline: sursă live doar pentru citire, 120 de secunde pentru fiecare execuție în mașina virtuală, 4 procesoare, 1 GiB memorie și un spațiu de lucru persistent de 128 MiB.",
  loadingModel: "Se încarcă modelul local în memorie.",
  choosingAction: "Se alege următoarea acțiune.",
  loadingSkill: "Se încarcă abilitatea document-review",
  loadedSkill: "S-a încărcat abilitatea document-review.",
  reading: (path) => `Se citește ${path}`,
  read: (path) => `S-a citit ${path}.`,
  runningCode: "Se rulează codul",
  ranCode: "Codul a rulat.",
  executionRunning: "Se rulează codul.",
  executionFinished: "Pas finalizat.",
  responseCompleted: "Răspuns finalizat.",
  thinking: [
    "Utilizatorul a atașat un document și vrea să fie verificat. Pare un contract de prestări servicii, deci verificarea utilă este pentru greșeli interne: date care nu se potrivesc, totaluri care nu corespund sumelor din tabel și clauze care se contrazic. Încarc abilitatea document-review, apoi citesc atașamentul.",
    "Contractul are 8 articole. Art. 2.1 începe la 1 decembrie 2026 și durează 12 luni, dar data de încheiere este 30 noiembrie 2026, înainte de început. Art. 3 are un tabel cu patru poziții și un total la art. 3.2. Art. 7 menționează preavizul de două ori. Verific datele și calculele cu cod, nu din cap.",
    "Verificarea confirmă trei probleme: data de încheiere este cu un an prea devreme, pozițiile din tabel însumează 98.500 lei, nu 97.500 lei, iar art. 7.3 spune 30 de zile, în timp ce art. 7.1 spune 60. Părțile, termenul de plată, limitarea răspunderii și semnăturile sunt coerente. Scriu un raport scurt cu fiecare greșeală, unde apare și cum se corectează.",
  ],
  readOutput: `exit_code: 0
termination: completed
stdout:
1: CONTRACT DE PRESTĂRI SERVICII
2: Nr. LA-2026-114 din 3 noiembrie 2026
3: Prezentul contract (denumit în continuare „Contractul”) se încheie între:
4: Luminis Analytics SRL, cu sediul în Cluj-Napoca (denumită în continuare „Prestatorul”), și
5: Casa Verde Retail SRL, cu sediul în București (denumită în continuare „Beneficiarul”).
6: ART. 1. OBIECTUL CONTRACTULUI
7: 1.1 Prestatorul va proiecta, dezvolta și întreține un tablou de bord…`,
  code: `from datetime import date, timedelta
from decimal import Decimal

# Art. 2.1: durata contractului
inceput = date(2026, 12, 1)
sfarsit_declarat = date(2026, 11, 30)
sfarsit_corect = date(inceput.year + 1, inceput.month, inceput.day) - timedelta(days=1)
print("Data de încheiere:", sfarsit_declarat, "corect:", sfarsit_corect,
      "OK" if sfarsit_declarat == sfarsit_corect else "DIFERENȚĂ")

# Art. 3: tabelul de prețuri față de totalul declarat
pozitii = [Decimal("22500.00"), Decimal("49000.00"), Decimal("6000.00"), 12 * Decimal("1750.00")]
total_declarat = Decimal("97500.00")
print("Poziții:", sum(pozitii), "total declarat:", total_declarat,
      "OK" if sum(pozitii) == total_declarat else "DIFERENȚĂ")

# Art. 7: perioadele de preaviz
preaviz_zile = {"7.1": 60, "7.3": 30}
print("Preaviz:", preaviz_zile,
      "OK" if len(set(preaviz_zile.values())) == 1 else "DIFERENȚĂ")
`,
  codeOutput: `Data de încheiere: 2026-11-30 corect: 2027-11-30 DIFERENȚĂ
Poziții: 98500.00 total declarat: 97500.00 DIFERENȚĂ
Preaviz: {'7.1': 60, '7.3': 30} DIFERENȚĂ
`,
  report: (fileName) => `## Verificarea documentului ${fileName}

Am citit toate cele 8 articole și am verificat datele, sumele și trimiterile între articole. Am găsit **3 greșeli** care trebuie corectate înainte de semnare.

| # | Unde | Greșeala | Corectură propusă |
|---|---|---|---|
| 1 | Art. 2.1, Durata | Contractul începe la 1 decembrie 2026 și durează 12 luni, dar se încheie la **30 noiembrie 2026**, înainte de început. | Modificați data de încheiere în **30 noiembrie 2027**. |
| 2 | Art. 3.2, Prețul | Totalul declarat este **97.500,00 lei**, dar cele patru poziții din tabel însumează **98.500,00 lei** (22.500 + 49.000 + 6.000 + 21.000). | Corectați totalul la 98.500,00 lei sau poziția greșită din tabel. |
| 3 | Art. 7.1 și 7.3, Încetarea | Art. 7.1 stabilește un preaviz de **60 de zile**, dar art. 7.3 se referă la „perioada de preaviz de **30 de zile** prevăzută la art. 7.1”. | Folosiți aceeași perioadă de preaviz în ambele clauze. |

**Verificate, fără probleme:** datele părților, termenul de plată (30 de zile), penalitățile de întârziere, limitarea răspunderii și semnăturile.

Limitarea răspunderii de la art. 6.1 trimite la totalul de la art. 3.2, deci corectarea greșelii 2 schimbă și această limită.`,
};

export function reviewScript(): ReviewScript {
  return currentLocale() === "ro" ? romanian : english;
}
