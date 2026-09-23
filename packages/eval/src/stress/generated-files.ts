import { inflateRawSync, inflateSync } from "node:zlib";

export interface FileCheck {
  type: boolean;
  content: boolean;
  note: string;
}

const STORY_PARAGRAPHS = 3;
const PARAGRAPH_LETTERS = 40;
const PDF_STORY_LETTERS = STORY_PARAGRAPHS * 200;
const SALARY_ROWS = 12;
const SALARY_COLUMNS = 5;

function zipEntries(bytes: Buffer): Map<string, string> {
  const entries = new Map<string, string>();
  try {
    const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (end < 0) return entries;
    let offset = bytes.readUInt32LE(end + 16);
    for (let index = 0; index < bytes.readUInt16LE(end + 10); index += 1) {
      const nameLength = bytes.readUInt16LE(offset + 28);
      const local = bytes.readUInt32LE(offset + 42);
      const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
      const data = bytes.subarray(start, start + bytes.readUInt32LE(offset + 20));
      const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
      const deflated = bytes.readUInt16LE(offset + 10) === 8;
      entries.set(name, (deflated ? inflateRawSync(data) : data).toString("utf8"));
      offset += 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
    }
  } catch {
    entries.clear();
  }
  return entries;
}

function xmlText(value: string): string {
  return value
    .replace(/<[^>]+>/gu, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function letters(text: string): number {
  return text.match(/\p{L}/gu)?.length ?? 0;
}

function ascii85(text: string): Buffer {
  const body = text.replace(/\s/gu, "").replace(/~>$/u, "").replaceAll("z", "!!!!!");
  const bytes: number[] = [];
  for (let index = 0; index < body.length; index += 5) {
    let value = 0;
    for (const char of body.slice(index, index + 5).padEnd(5, "u")) {
      value = value * 85 + char.charCodeAt(0) - 33;
    }
    const count = Math.min(4, body.length - index - 1);
    for (let shift = 3; shift >= 4 - count; shift -= 1) bytes.push((value >>> (shift * 8)) & 0xff);
  }
  return Buffer.from(bytes);
}

function streamContent(raw: Buffer): string {
  const text = raw.toString("latin1").trim();
  const data = text.endsWith("~>") ? ascii85(text) : raw;
  try {
    return inflateSync(data).toString("latin1");
  } catch {
    return data.toString("latin1");
  }
}

function shownText(content: string): string[] {
  return [...content.matchAll(/BT([\s\S]*?)ET/gu)].flatMap((block) =>
    [...(block[1] ?? "").matchAll(/\(((?:\\[\s\S]|[^\\)])*)\)/gu)].map((text) => text[1] ?? ""),
  );
}

function pdfText(bytes: Buffer): string {
  const source = bytes.toString("latin1");
  const strings: string[] = [];
  for (const match of source.matchAll(/(?<!end)stream\r?\n/gu)) {
    const start = (match.index ?? 0) + match[0].length;
    strings.push(
      ...shownText(streamContent(bytes.subarray(start, source.indexOf("endstream", start)))),
    );
  }
  return strings.join(" ");
}

export function storyPdf(bytes: Buffer): FileCheck {
  const type = bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  const text = type ? pdfText(bytes) : "";
  const count = letters(text);
  return {
    type,
    content: count >= PDF_STORY_LETTERS,
    note: `${count} letters of PDF text: ${text.slice(0, 3_000)}`,
  };
}

export function storyDocx(bytes: Buffer): FileCheck {
  const document = zipEntries(bytes).get("word/document.xml");
  const paragraphs = [...(document ?? "").matchAll(/<w:p[ >][\s\S]*?<\/w:p>/gu)]
    .map((paragraph) => xmlText(paragraph[0]))
    .filter((paragraph) => letters(paragraph) >= PARAGRAPH_LETTERS);
  return {
    type: document !== undefined,
    content: paragraphs.length >= STORY_PARAGRAPHS,
    note: `${paragraphs.length} paragraphs: ${paragraphs.join("\n").slice(0, 3_000)}`,
  };
}

type Cell = string | number;

function cellValue(attributes: string, body: string, shared: string[]): Cell {
  const value = /<v>([^<]*)<\/v>/u.exec(body)?.[1];
  if (attributes.includes('t="s"')) return shared[Number(value)] ?? "";
  if (attributes.includes('t="inlineStr"') || attributes.includes('t="str"')) {
    return xmlText(body);
  }
  return value === undefined ? "" : Number(value);
}

function sheetRows(entries: Map<string, string>): Cell[][] {
  const shared = [
    ...(entries.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/gu),
  ];
  const strings = shared.map((item) => xmlText(item[1] ?? ""));
  const sheet = entries.get("xl/worksheets/sheet1.xml") ?? "";
  return [...sheet.matchAll(/<row\b[^>]*[^/]>([\s\S]*?)<\/row>/gu)].map((row) =>
    [...(row[1] ?? "").matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu)]
      .map((cell) => cellValue(cell[1] ?? "", cell[2] ?? "", strings))
      .filter((value) => value !== ""),
  );
}

export function salaryWorkbook(bytes: Buffer): FileCheck {
  const entries = zipEntries(bytes);
  const rows = sheetRows(entries);
  const numeric = (row: Cell[]) =>
    row.filter((value): value is number => typeof value === "number");
  const salaries = rows.filter((row) => numeric(row).length > 0);
  const first = rows.findIndex((row) => numeric(row).length > 0);
  const names = (first > 0 ? (rows[first - 1] ?? []) : []).filter(
    (value) => typeof value === "string" && value.trim() !== "",
  );
  const valid = salaries.every((row) => {
    const values = numeric(row);
    return (
      values.length === SALARY_COLUMNS && values.every((value) => value >= 2000 && value <= 10000)
    );
  });
  return {
    type: entries.has("xl/workbook.xml"),
    content: salaries.length === SALARY_ROWS && names.length >= SALARY_COLUMNS && valid,
    note: `header: ${names.join(", ")}; rows: ${JSON.stringify(salaries).slice(0, 3_000)}`,
  };
}
