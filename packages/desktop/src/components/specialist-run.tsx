import type { AgentRunSummary } from "@gardendesk/shared";
import { Icon } from "./icons.js";

const identities = {
  "document-review": { name: "Document review", icon: "read", color: "neutral" },
  "invoice-expense-review": {
    name: "Invoice and expense review",
    icon: "receipt",
    color: "orange",
  },
  "financial-reconciliation": {
    name: "Financial reconciliation",
    icon: "reconcile",
    color: "teal",
  },
  "matter-chronology": { name: "Matter chronology", icon: "timeline", color: "gold" },
  "contract-obligations": { name: "Contract obligations", icon: "document-check", color: "violet" },
  "document-comparison": { name: "Document comparison", icon: "compare", color: "rose" },
} as const;

export function specialistIdentity(agentId: string | null | undefined) {
  return (
    identities[agentId as keyof typeof identities] ?? {
      name: "Task",
      icon: "subagent" as const,
      color: "neutral",
    }
  );
}

export function specialistStatus(state: AgentRunSummary["state"]) {
  return {
    queued: "Waiting",
    running: "Working",
    succeeded: "Complete",
    failed: "Failed",
    cancelled: "Stopped",
  }[state];
}

export function SpecialistIcon({ agentId }: { agentId: string | null | undefined }) {
  const identity = specialistIdentity(agentId);
  return (
    <span className={`specialist-icon specialist-${identity.color}`}>
      <Icon name={identity.icon} />
    </span>
  );
}

export function SpecialistRunRow({
  run,
  onOpen,
}: {
  run: AgentRunSummary;
  onOpen(run: AgentRunSummary): void;
}) {
  const identity = specialistIdentity(run.agentId);
  return (
    <div className="activity-row" data-kind="specialist">
      <span className="activity-row-icon">
        <SpecialistIcon agentId={run.agentId} />
      </span>
      <button
        className="activity-row-label"
        id={`specialist-run-${run.id}`}
        onClick={() => onOpen(run)}
        type="button"
      >
        {identity.name} · {specialistStatus(run.state)}
      </button>
    </div>
  );
}
