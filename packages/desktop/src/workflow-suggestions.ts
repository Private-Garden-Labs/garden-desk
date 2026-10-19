import type { CommandSummary } from "@gardendesk/shared";
import { type TranslationKey, t } from "./i18n/index.js";

const DESCRIPTIONS = {
  review: "commandDescription.review",
  obligations: "commandDescription.obligations",
  reconcile: "commandDescription.reconcile",
  expenses: "commandDescription.expenses",
} as const satisfies Record<string, TranslationKey>;

export function commandDescription(command: CommandSummary): string {
  const key = DESCRIPTIONS[command.name as keyof typeof DESCRIPTIONS];
  return key === undefined ? command.description : t(key);
}

const DOCUMENT = /\.(?:pdf|docx?|txt|md)$/iu;
const SHEET = /\.(?:xlsx|xls|csv)$/iu;

function workflowOrder(attachmentNames: string[], folderFileNames: string[]): string[] {
  const [only] = attachmentNames;
  if (attachmentNames.length === 1 && only !== undefined && DOCUMENT.test(only)) {
    return ["review", "obligations"];
  }
  const files = attachmentNames.length > 0 ? attachmentNames : folderFileNames;
  const sheets = files.filter((name) => SHEET.test(name)).length;
  const documents = files.filter((name) => DOCUMENT.test(name)).length;
  if (sheets > 0 && sheets >= documents) {
    return sheets > 1
      ? ["reconcile", "expenses", "obligations"]
      : ["expenses", "reconcile", "obligations"];
  }
  if (files.length > 0) return ["obligations", "expenses", "reconcile"];
  return ["review", "obligations", "reconcile", "expenses"];
}

export function suggestedWorkflows(
  commands: CommandSummary[],
  attachmentNames: string[],
  folderFileNames: string[],
): CommandSummary[] {
  return workflowOrder(attachmentNames, folderFileNames).flatMap((name) => {
    const command = commands.find((candidate) => candidate.name === name);
    return command === undefined ? [] : [command];
  });
}
