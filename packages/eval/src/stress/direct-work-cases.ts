import type { SpecialistCase } from "./specialist-fixtures.js";

export const cases: SpecialistCase[] = [
  {
    id: "intake-mixed",
    agentId: null,
    files: {
      "register.xlsx": {
        sheet: "Invoices",
        rows: [
          ["Invoice", "Amount", "Currency"],
          ["A-17", 120, "EUR"],
        ],
      },
      "terms.docx": "Payment terms\nPayment is due within 30 days.",
      "receipt.pdf": "Receipt R-17\nReceived EUR 120 for invoice A-17.",
    },
    request:
      "Inspect this mixed folder before batch work. Report fileCount, spreadsheetSheet, spreadsheetHeaders (in column order), and pdfPageCount.",
    expected: {
      fileCount: 3,
      spreadsheetSheet: "Invoices",
      spreadsheetHeaders: ["Invoice", "Amount", "Currency"],
      pdfPageCount: 1,
    },
    sources: ["register.xlsx", "terms.docx", "receipt.pdf"],
  },
  {
    id: "intake-live-header",
    agentId: null,
    files: {
      "register.xlsx": {
        sheet: "Export",
        rows: [["Monthly export"], [], ["Reference", "Net", "Tax"], ["B-2", 100, 19]],
      },
    },
    addedAfterGrant: { "late.csv": "invoice,gross,currency\nB-3,75,EUR\n" },
    request:
      "Inspect all files currently in this folder. Report fileNames (sorted), workbookHeaderRow (one-based), and csvHeaders (in column order).",
    expected: {
      fileNames: ["late.csv", "register.xlsx"],
      workbookHeaderRow: 3,
      csvHeaders: ["invoice", "gross", "currency"],
    },
    sources: ["register.xlsx", "late.csv"],
  },
  {
    id: "extraction-currencies",
    agentId: null,
    files: {
      "invoice-eur.pdf":
        "Invoice E-10\nIssue date: 2026-08-01. Currency: EUR. Net: 100. Tax: 19. Total: 119.",
      "invoice-usd.pdf":
        "Invoice U-20\nIssue date: 2026-08-02. Currency: USD. Net: 100. Tax: 0. Total: 100.",
    },
    request:
      "Extract both invoice records without currency conversion. Report invoiceIds (sorted), eurGrossTotal, and usdGrossTotal.",
    expected: { invoiceIds: ["E-10", "U-20"], eurGrossTotal: 119, usdGrossTotal: 100 },
    sources: ["invoice-eur.pdf", "invoice-usd.pdf"],
  },
  {
    id: "brief-board",
    agentId: null,
    files: {
      "minutes.docx":
        "Board decision dated 2026-08-10\nApprove EUR 5000 for project Cedar. Owner: Maya. Deadline: 2026-09-30.",
      "ledger.xlsx": {
        sheet: "Spend",
        rows: [
          ["Project", "Spent", "Currency"],
          ["Cedar", 3200, "EUR"],
        ],
      },
      "status.pdf": "Project Cedar status\nOne supplier quote remains pending.",
    },
    request:
      "Build the evidence brief for project Cedar. Report approvedBudget, spent, remainingBudget, owner, deadline, and pendingQuoteCount.",
    expected: {
      approvedBudget: 5000,
      spent: 3200,
      remainingBudget: 1800,
      owner: "Maya",
      deadline: "2026-09-30",
      pendingQuoteCount: 1,
    },
    sources: ["minutes.docx", "ledger.xlsx", "status.pdf"],
  },
];
