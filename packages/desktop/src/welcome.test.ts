import { AttachmentSummarySchema } from "@gardendesk/shared";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Conversation } from "./components/conversation.js";

const emptyConversation = {
  artifacts: [],
  onSuggestion: () => undefined,
  performance: null,
  ready: true,
  runId: undefined,
  timeline: [],
};

describe("empty conversation context", () => {
  it("shows the folder name for a folder conversation", () => {
    const markup = renderToStaticMarkup(
      createElement(Conversation, { ...emptyConversation, folderName: "Project files" }),
    );

    expect(markup).toMatch(/What should we work on in\s*<span[^>]*>Project files<\/span>\?/);
    expect(markup).not.toContain("welcome-context");
  });

  it("suggests review first for one attached contract", () => {
    const markup = renderToStaticMarkup(
      createElement(Conversation, {
        ...emptyConversation,
        attachments: [
          AttachmentSummarySchema.parse({
            byteLength: 1,
            contentHash: `sha256:${"b".repeat(64)}`,
            createdAt: "2026-07-20T11:59:59.000Z",
            id: "b6b7467e-6811-4cd1-87d3-99812f6432d6",
            mediaType: "application/pdf",
            name: "contract.pdf",
            sessionId: "9dbb56fd-c75a-4749-9d74-5b8ef084a6de",
          }),
        ],
        commands: ["review", "obligations", "reconcile", "expenses"].map((name) => ({
          description: `${name} description`,
          name,
        })),
      }),
    );

    expect(markup).toMatch(/<button[^>]*>\s*<span[^>]*>\/review</);
    expect(markup).toContain("Suggested for contract.pdf");
  });

  it("shows no context label for a global chat", () => {
    const markup = renderToStaticMarkup(createElement(Conversation, emptyConversation));

    expect(markup).toContain("What should we work on?");
    expect(markup).not.toContain("What should we work on in");
  });
});
