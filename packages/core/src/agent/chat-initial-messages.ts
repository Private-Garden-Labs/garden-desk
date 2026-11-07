import { type ChatMessage, LAW_DISCLAIMER } from "@gardendesk/shared";
import { fillPrompt } from "../prompt-files.js";
import type { ChatAgentInput } from "./chat-loop.js";

export function withLawDisclaimer(input: Pick<ChatAgentInput, "laws">, response: string): string {
  if (
    input.laws?.searched() !== true ||
    input.laws.id.startsWith("company:") ||
    response.includes(LAW_DISCLAIMER)
  )
    return response;
  return `${response}\n\n${LAW_DISCLAIMER}`;
}

export function replyLanguagePrompt(
  input: Pick<ChatAgentInput, "replyLanguage" | "systemPrompt">,
): string[] {
  return input.replyLanguage === undefined
    ? []
    : [fillPrompt(input.systemPrompt("reply-language"), { language: input.replyLanguage })];
}

function systemText(input: ChatAgentInput): string {
  const skills = input.skills
    .metadata()
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join("\n");
  const specialists = (input.subagents ?? [])
    .map((agent) => `- ${agent.name}: ${agent.description}`)
    .join("\n");
  return [
    input.agent.body,
    input.systemPrompt("environment"),
    ...(skills ? [fillPrompt(input.systemPrompt("skills"), { skills })] : []),
    ...(specialists ? [fillPrompt(input.systemPrompt("specialists"), { specialists })] : []),
    ...replyLanguagePrompt(input),
  ].join("\n\n");
}

export function initialChatMessages(input: ChatAgentInput): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", text: systemText(input) }];
  if (input.history?.summary) {
    messages.push({
      role: "user",
      text: fillPrompt(input.systemPrompt("anchored-summary"), { summary: input.history.summary }),
    });
  } else {
    for (const item of input.history?.messages ?? []) {
      messages.push({
        role: item.role,
        text: item.content,
        ...(item.role === "assistant" ? { toolCalls: [] } : {}),
      } as ChatMessage);
    }
  }
  const attachments = input.attachments?.length
    ? `\n${fillPrompt(input.systemPrompt("attachments"), {
        attachments: JSON.stringify(input.attachments),
      })}`
    : "";
  messages.push({ role: "user", text: `${input.task}${attachments}` });
  return messages;
}
