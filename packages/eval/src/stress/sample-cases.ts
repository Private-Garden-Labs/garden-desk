export interface SampleTask {
  id: string;
  agentId: string | null;
  folders?: string[];
  attachments?: string[];
  command?: string;
  prompt: string;
  checks: RegExp[];
}

function date(day: number, month: string, number: number): RegExp {
  const name = `(${month}|${month.slice(0, 3)})`;
  return new RegExp(
    `\\b${day}(st|nd|rd|th)? ${name}\\b|\\b${name}\\.? ${day}\\b|2026-0?${number}-0?${day}\\b|\\b0?${day}/0?${number}/2026`,
    "iu",
  );
}
const march = (day: number) => date(day, "march", 3);
const ids = (numbers: string[]) => numbers.map((number) => new RegExp(`\\b${number}\\b`, "u"));

const agreement = "supplier-agreement-2026.docx";
const amendment = "supplier-agreement-2026-amendment-1.docx";
const invoice = "invoice-INV-2026-0142.pdf";
const bank = "bank-statements-2026-q1";
const ledger = "sales-ledger-2026-q1";
const matter = "matter-2026-014-water-damage";

export const cases: SampleTask[] = [
  {
    id: "sample-bank-structure",
    agentId: null,
    folders: [bank],
    prompt: "What is in this folder and how are the files structured?",
    checks: [/statement/iu, /\b(three|3)\b/iu, /money in/iu, /balance/iu, /21134\.87/u],
  },
  {
    id: "sample-bank-totals",
    agentId: null,
    folders: [bank],
    prompt:
      "Give total money in, total money out, and closing balance for each month, then the quarter",
    checks: [
      /16470\b/u,
      /19515\.68/u,
      /21134\.87/u,
      /27684\b/u,
      /17380\.05/u,
      /31438\.82/u,
      /18324\b/u,
      /21387\.62/u,
      /28375\.2/u,
      /62478\b/u,
      /58283\.35/u,
    ],
  },
  {
    id: "sample-bank-finca",
    agentId: null,
    folders: [bank],
    prompt: "How much did we pay Finca Alta Trading this quarter, and when?",
    checks: [
      /12596\b/u,
      /4512\b/u,
      /3948\b/u,
      /4136\b/u,
      date(9, "january", 1),
      date(11, "february", 2),
      march(10),
    ],
  },
  {
    id: "sample-ledger-open",
    agentId: null,
    folders: [ledger],
    prompt: "List the open invoices with customer, issue date, and gross amount",
    checks: [
      /12498\b/u,
      ...ids(["0139", "0148", "0150", "0152", "0153", "0154", "0155", "0156"]),
      ...ids(["0157", "0158", "0159", "0160"]),
    ],
  },
  {
    id: "sample-customers-owe",
    agentId: null,
    folders: [ledger, bank],
    prompt: "Which customers still owe us money at 31 March 2026, and how much each?",
    checks: [/12498\b/u, /INV-2026-0139\b/iu],
  },
  {
    id: "sample-reconcile",
    agentId: "financial-review",
    folders: [ledger, bank],
    command: "reconcile",
    prompt:
      "Reconcile the sales ledger against the bank statements for January to March 2026, matching on invoice number.",
    checks: [...ids(["0107", "0115", "0121", "0139"]), /\b252\b/u, /8184\b/u],
  },
  {
    id: "sample-chronology",
    agentId: "matter-chronology",
    folders: [matter],
    prompt: "Build a chronology of this matter with all sources and flag conflicting dates.",
    checks: [
      march(2),
      march(3),
      march(4),
      /\b0?8:12\b/u,
      march(11),
      march(12),
      march(16),
      march(18),
      /4138\b/u,
    ],
  },
  {
    id: "sample-landlord-knew",
    agentId: null,
    folders: [matter],
    prompt: "When did the landlord first know about the leak, according to each record?",
    checks: [march(2), march(3), march(4), /\b0?8:12\b/u],
  },
  {
    id: "sample-agreement-review",
    agentId: "document-review",
    attachments: [agreement],
    command: "review",
    prompt: "Review this document for errors and inconsistencies.",
    checks: [/schedule 2/iu, /S\.A\./u, date(1, "march", 3), date(1, "february", 2)],
  },
  {
    id: "sample-handbook-review",
    agentId: "document-review",
    attachments: ["staff-handbook-extract.doc"],
    command: "review",
    prompt: "Review this document for errors and inconsistencies.",
    checks: [
      /six months|6 months/iu,
      /three months|3 months/iu,
      /twenty-eight|28 days/iu,
      /\b25 days|twenty-five days/iu,
    ],
  },
  {
    id: "sample-invoice-review",
    agentId: "document-review",
    attachments: [invoice],
    command: "review",
    prompt: "Review this document for errors and inconsistencies.",
    checks: [/3984\b/u, /3948\b/u, date(1, "june", 6), date(11, "june", 6)],
  },
  {
    id: "sample-agreement-obligations",
    agentId: "contract-obligations",
    attachments: [agreement],
    command: "obligations",
    prompt: "List the obligations for the Buyer and the Supplier.",
    checks: [
      /400 ?kg/iu,
      /(10|ten) business days/iu,
      /9\.40?\b/u,
      /60 days/iu,
      /(5|five) business days/iu,
      /(15|fifteen) business days/iu,
      /30 days/iu,
      /1000000|1 million|1m\b/iu,
      /90 days/iu,
      /20 days/iu,
      /(3|three) years/iu,
      /14 days/iu,
    ],
  },
  {
    id: "sample-amendment-comparison",
    agentId: "document-comparison",
    attachments: [agreement, amendment],
    prompt:
      "Compare the amendment against the original agreement and list every change with both source locations.",
    checks: [
      /350 ?kg/iu,
      /400 ?kg/iu,
      /9\.85/u,
      /9\.40?\b/u,
      /120 days/iu,
      /90 days/iu,
      /30 ?kg/iu,
    ],
  },
  {
    id: "sample-amendment-obligations",
    agentId: "contract-obligations",
    attachments: [agreement, amendment],
    command: "obligations",
    prompt: "List the obligations for the Supplier as they apply from 1 June 2026.",
    checks: [
      /9\.85/u,
      /120 days/iu,
      /30 ?kg/iu,
      /(10|ten) business days/iu,
      /(15|fifteen) business days/iu,
      /350 ?kg/iu,
    ],
  },
  {
    id: "sample-compare-then-obligations",
    agentId: "document-comparison",
    attachments: [agreement, amendment],
    prompt:
      "Compare the amendment against the original agreement and list every change. Then list the Supplier's obligations as they apply from 1 June 2026.",
    checks: [
      /350 ?kg/iu,
      /9\.85/u,
      /120 days/iu,
      /30 ?kg/iu,
      /(10|ten) business days/iu,
      /(15|fifteen) business days/iu,
      /1000000|1 million/iu,
      /14 days/iu,
    ],
  },
  {
    id: "sample-invoice-expenses",
    agentId: "financial-review",
    attachments: [invoice],
    command: "expenses",
    prompt: "Check this invoice.",
    checks: [/3984\b/u, /3948\b/u, /5073\.6/u, date(11, "june", 6)],
  },
  {
    id: "sample-claims-policy",
    agentId: "financial-review",
    attachments: ["q2-expense-claims.xlsx", "expense-policy.pdf"],
    command: "expenses",
    prompt: "Check every claim against the policy.",
    checks: ids(["0209", "0214", "0217", "0220", "0223", "0225"]),
  },
  {
    id: "sample-invoice-agreement",
    agentId: "financial-review",
    attachments: [invoice, agreement, amendment],
    command: "expenses",
    prompt: "Check this invoice against the supply agreement and its amendment.",
    checks: [/9\.85/u, /\b14\b.{0,30}bags/iu, /\b40\b.{0,30}bags/iu, /3984\b/u],
  },
  {
    id: "sample-priya-claims",
    agentId: null,
    attachments: ["q2-expense-claims.xlsx"],
    prompt: "List all claims by Priya Shah with date, category, and amount",
    checks: [/504\.3/u, ...ids(["0201", "0202", "0209", "0211", "0216", "0217", "0221", "0225"])],
  },
  {
    id: "sample-policy-limits",
    agentId: null,
    attachments: ["expense-policy.pdf"],
    prompt: "What are the spending limits and who approves a GBP 250 claim?",
    checks: [
      /\b25(\.00)?\b/u,
      /\b140(\.00)?\b/u,
      /0\.45/u,
      /\b10(\.00)?\b/u,
      /30 days/iu,
      /\b200(\.00)?\b/u,
      /managing director|okafor/iu,
    ],
  },
  {
    id: "sample-handbook-notice",
    agentId: null,
    attachments: ["staff-handbook-extract.doc"],
    prompt: "How much notice does an employee with six years of service have to give?",
    checks: [/two months|2 months/iu, /6\.1/u],
  },
  {
    id: "sample-agreement-stop",
    agentId: null,
    attachments: [agreement],
    prompt: "What happens if the Buyer wants to stop buying at the end of the first year?",
    checks: [/90 days/iu, /60 days/iu, /1\.2/u, /7\.1/u],
  },
];
