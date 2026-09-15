import { object, objectSchema, type ToolSpec, textParam } from "./generic-tool-support.js";

export function reviewTool(): ToolSpec {
  return {
    definition: {
      name: "review",
      description:
        "Review one text document for inconsistencies. Extracts the file itself; for that check, call it before any skill or extraction. Returns findings and a numbered text path. No calculations or image inspection.",
      params: objectSchema(
        {
          path: {
            type: "string",
            description: "Exact guest path under /source, /run/attachments, or /workspace.",
          },
          prompt: { type: "string", description: "The text check to perform." },
        },
        ["path", "prompt"],
      ),
    },
    parse: (value) => {
      const params = object(value);
      return {
        path: textParam(params, "path", 4_096),
        prompt: textParam(params, "prompt", 16_384),
      };
    },
    execute: async (value, context) => {
      if (context.reviewDocument === undefined)
        return { content: "Document review is not available.", failed: true };
      const { path, prompt } = value as { path: string; prompt: string };
      return context.reviewDocument(path, prompt);
    },
  };
}
