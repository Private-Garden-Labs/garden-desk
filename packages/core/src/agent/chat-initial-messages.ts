import type { ChatMessage } from "@gardendesk/shared";
import { fillPrompt } from "../prompt-files.js";
import type { ChatAgentInput } from "./chat-loop.js";

function systemText(input: ChatAgentInput): string {
  const skills = input.skills
    .metadata()
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join("\n");
  return [
    input.agent.body,
    input.systemPrompt("environment"),
    ...(skills ? [fillPrompt(input.systemPrompt("skills"), { skills })] : []),
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
