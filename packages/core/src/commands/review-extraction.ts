import { DOCUMENT_SUFFIXES, documentTextSource } from "../agent/document-text-source.js";

export function reviewExtractionSource(
  path: string,
  outputPath = "/workspace/.garden-desk-tools/review-extracted.txt",
): string {
  return `from pathlib import Path
import os
import subprocess
${documentTextSource}

path = Path(${JSON.stringify(path)})
suffix = path.suffix.lower()
if suffix in ${DOCUMENT_SUFFIXES}:
    text = document_text(path)
elif suffix in ('.txt', '.md'):
    text = path.read_text(encoding='utf-8')
else:
    raise ValueError('Supported review files: DOC, DOCX, PDF, TXT, MD.')
if not text.strip():
    raise ValueError('The document has no readable text.')
text = '\\n'.join(f'{number}: {line}' for number, line in enumerate(text.splitlines(), 1))
Path(${JSON.stringify(outputPath)}).write_text(text, encoding='utf-8')
print(text)
`;
}
