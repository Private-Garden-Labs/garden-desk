import { useEffect, useRef, useState } from "react";
import capabilities from "../../../workers/images/agent/capabilities.json" with { type: "json" };
import { Icon } from "./icons.js";
import { copyUserMessage } from "./user-message.js";

const EXAMPLE = [
  "---",
  "name: release-notes",
  "description: Turn a change list into release notes for customers. Use for a release summary.",
  "---",
  "Group the changes by the effect on the customer, newest first.",
  "Name every change with the file it came from.",
].join("\n");

const SKIPPED = [
  "Linux",
  "BusyBox",
  "DarkGarden font",
  "Bitstream Vera fonts",
  "DejaVu fonts",
  "WenQuanYi Zen Hei font",
  "et-xmlfile",
  "typing-extensions",
  "charset-normalizer",
];

function guestTools(): string {
  return Object.entries(capabilities.runtimes)
    .filter(([name]) => !SKIPPED.includes(name))
    .map(([name, version]) => `${name} ${version}`)
    .join(", ");
}

export function agentPrompt(): string {
  const { sourceMount, workspaceMount, shell } = capabilities;
  return [
    "Read https://agentskills.io/specification, then write one SKILL.md file for Garden Desk.",
    "The skill is for: <say what the work is, and when Garden Desk should use it>.",
    "Keep to these limits:",
    "- One Markdown file. The frontmatter holds only a name (lowercase words joined by hyphens) and a description (one line that says what the skill does and when to use it). The body holds the instructions.",
    `- The model runs offline on this computer. Every command runs in a virtual machine with no network. ${sourceMount.path} is the selected folder and is read-only, ${workspaceMount.path} is writable and kept, and attachments are under /run/attachments.`,
    `- The guest has ${shell} plus ${guestTools()}. Nothing can be installed and nothing can be fetched.`,
    "- Write short imperative steps: when to use the skill, what to read, what to calculate, what to cite, and what the result must contain.",
    "- Do not add scripts, extra files, or tool definitions. The body is instructions only.",
  ].join("\n");
}

export function SkillHelp({ nativeActionMessage }: { nativeActionMessage: string | undefined }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (timer.current !== undefined) clearTimeout(timer.current);
    },
    [],
  );
  const copy = async () => {
    try {
      await copyUserMessage(agentPrompt());
      setCopied(true);
    } catch {
      setCopied(false);
    }
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2_000);
  };
  return (
    <details className="skill-help">
      <summary>How to write a skill</summary>
      <p>
        A skill is one Markdown file named SKILL.md. It opens with a name and a one-line
        description, then the instructions Garden Desk follows when it loads the skill.
      </p>
      <pre>{EXAMPLE}</pre>
      <p>
        Garden Desk follows the open Agent Skills format. A coding agent can write one for you: copy
        the prompt below, say what the skill is for, and save the answer as a Markdown file.
      </p>
      <pre className="skill-help-prompt">{agentPrompt()}</pre>
      <button
        className="skills-action"
        disabled={nativeActionMessage !== undefined}
        onClick={() => void copy()}
        title={nativeActionMessage}
        type="button"
      >
        <Icon name={copied ? "copy-check" : "copy"} />
        <span aria-live="polite">{copied ? "Prompt copied" : "Copy the prompt"}</span>
      </button>
    </details>
  );
}
