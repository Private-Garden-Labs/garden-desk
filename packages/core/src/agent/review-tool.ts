import { object, objectSchema, type ToolSpec, textParam } from "./generic-tool-support.js";

/** Work from the user's request that the main agent still does after this turn; empty when none. */
export const remainingSchema = {
  type: "string",
  description:
    "Work from the user's request that you will still do after the calls of this turn finish. Use an empty string when the answers of this turn complete the whole request; they then go to the user unchanged.",
};

export function remainingParam(value: Record<string, unknown>): string {
  const item = value.remaining;
  if (typeof item !== "string" || item.length > 4_096) {
    throw new Error("invalid_remaining: use text with at most 4096 characters, or an empty string");
  }
  return item;
}

export function reviewTool(): ToolSpec {
  return {
    definition: {
      name: "review",
      description:
        "Review or proofread one DOC, DOCX, text PDF, TXT, or MD document for errors or inconsistencies. Not for questions about a document or for checks that need calculations, such as invoice or expense totals. Extracts the file itself, including binary DOC; call it before any skill or extraction. Returns findings and a numbered text path. No calculations or image inspection.",
      params: objectSchema(
        {
          path: {
            type: "string",
            description: "Exact guest path under /source, /run/attachments, or /workspace.",
          },
          prompt: {
            type: "string",
            description:
              "The user's request in the user's own words. Add no instructions; the review has its own.",
          },
          remaining: remainingSchema,
        },
        ["path", "prompt", "remaining"],
      ),
    },
    parse: (value) => {
      const params = object(value);
      return {
        path: textParam(params, "path", 4_096),
        prompt: textParam(params, "prompt", 16_384),
        remaining: remainingParam(params),
      };
    },
    execute: async (value, context) => {
      if (context.reviewDocument === undefined)
        return { content: "Document review is not available.", failed: true };
      const { path, prompt, remaining } = value as {
        path: string;
        prompt: string;
        remaining: string;
      };
      return {
        ...(await context.reviewDocument(path, prompt, context.toolCallId)),
        remainingWork: remaining,
      };
    },
  };
}
