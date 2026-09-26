import type { SpecialistCase } from "./specialist-fixtures.js";

const invoices = Array.from({ length: 120 }, (_, index) => {
  const number = index + 1;
  return {
    id: `INV-${String(number).padStart(4, "0")}`,
    day: (number % 28) + 1,
    amount: 100 + ((number * 37) % 900),
    currency: number % 15 === 0 ? "USD" : "EUR",
  };
});
const unpaidIds = ["INV-0017", "INV-0058", "INV-0103"];
const shortPayments: Record<string, number> = { "INV-0024": 40, "INV-0091": 125 };

export const cases: SpecialistCase[] = [
  {
    id: "reconciliation-partial",
    agentId: "financial-review",
    files: {
      "invoices.xlsx": {
        sheet: "Invoices",
        rows: [
          ["Invoice", "Gross", "Currency"],
          ["A", 100, "EUR"],
          ["B", 200, "EUR"],
          ["C", 50, "EUR"],
          ["D", 75, "EUR"],
        ],
      },
      "payments.csv": "invoice,amount,currency\nA,100,EUR\nB,150,EUR\nC,50,EUR\n",
    },
    request:
      "Match by invoice ID and currency. Report fullyPaidIds (sorted), partialInvoiceId, partialBalance, unpaidInvoiceId, and totalOutstanding.",
    expected: {
      fullyPaidIds: ["A", "C"],
      partialInvoiceId: "B",
      partialBalance: 50,
      unpaidInvoiceId: "D",
      totalOutstanding: 125,
    },
    sources: ["invoices.xlsx", "payments.csv"],
  },
  {
    id: "reconciliation-large-folder",
    agentId: "financial-review",
    files: {
      ...Object.fromEntries(
        invoices.map((invoice) => [
          `invoices/${invoice.id}.pdf`,
          `Invoice ${invoice.id}\nIssue date: 2026-07-${String(invoice.day).padStart(2, "0")}\nCurrency: ${invoice.currency}\nTotal due: ${invoice.amount}`,
        ]),
      ),
      "payments.xlsx": {
        sheet: "Payments",
        rows: [
          ["Invoice", "Amount", "Currency"],
          ...invoices
            .filter((invoice) => !unpaidIds.includes(invoice.id))
            .map((invoice) => [
              invoice.id,
              invoice.amount - (shortPayments[invoice.id] ?? 0),
              invoice.currency,
            ])
            .reverse(),
        ],
      },
    },
    request:
      "Match every invoice PDF in /source/invoices to /source/payments.xlsx by invoice ID and currency. Report invoiceCount, unpaidIds (sorted), partialIds (sorted), and totalOutstandingEur.",
    expected: {
      invoiceCount: 120,
      unpaidIds,
      partialIds: ["INV-0024", "INV-0091"],
      totalOutstandingEur: 1651,
    },
    sources: ["payments.xlsx", "invoices/"],
  },
  {
    id: "reconciliation-ambiguous",
    agentId: "financial-review",
    command: "reconcile",
    files: {
      "invoices.csv": "row,invoice,amount,currency\n1,X,100,EUR\n2,Y,80,EUR\n3,Y,80,EUR\n",
      "bank.xlsx": {
        sheet: "Bank",
        rows: [
          ["Invoice", "Amount", "Currency"],
          ["X", 100, "USD"],
          ["Y", 80, "EUR"],
        ],
      },
    },
    request:
      "Match only when invoice ID and currency agree and the invoice row is unique. Report currencyMismatchId, duplicateInvoiceId, and unambiguousMatchCount.",
    expected: { currencyMismatchId: "X", duplicateInvoiceId: "Y", unambiguousMatchCount: 0 },
    sources: ["invoices.csv", "bank.xlsx"],
  },
  {
    id: "expenses-duplicates",
    agentId: "financial-review",
    files: {
      "claims.xlsx": {
        sheet: "Claims",
        rows: [
          ["Claim", "Invoice", "Amount", "Currency"],
          ["C1", "R-5", 72, "EUR"],
          ["C2", "R-5", 72, "EUR"],
        ],
      },
      "receipt.pdf": "Invoice R-5\nQuantity 3 at EUR 20 each. Tax EUR 10. Stated total EUR 72.",
    },
    request:
      "Check arithmetic and possible duplicate claims. Report duplicateInvoiceId, expectedReceiptTotal, statedReceiptTotal, and receiptOverstatement.",
    expected: {
      duplicateInvoiceId: "R-5",
      expectedReceiptTotal: 70,
      statedReceiptTotal: 72,
      receiptOverstatement: 2,
    },
    sources: ["claims.xlsx", "receipt.pdf"],
  },
  {
    id: "expenses-policy",
    agentId: "financial-review",
    command: "expenses",
    files: {
      "policy.docx":
        "Expense rules\nEach meal claim must not exceed EUR 40.\nEvery claim requires a receipt.",
      "claims.csv":
        "claim,category,amount,currency,receipt\nM1,meal,55,EUR,meal.pdf\nT1,taxi,25,EUR,\n",
      "meal.pdf": "Meal receipt\nTotal: EUR 55. Claim: M1.",
    },
    request:
      "Apply only the supplied policy. Report overLimitClaimId, excessAmount, and missingReceiptClaimId.",
    expected: { overLimitClaimId: "M1", excessAmount: 15, missingReceiptClaimId: "T1" },
    sources: ["policy.docx", "claims.csv", "meal.pdf"],
  },
];
