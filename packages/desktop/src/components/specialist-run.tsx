import type { AgentRunSummary } from "@gardendesk/shared";
import { t } from "../i18n/index.js";
import { Icon } from "./icons.js";

const identities = {
  "document-review": { icon: "read", color: "neutral" },
  "financial-review": { icon: "reconcile", color: "teal" },
  "matter-chronology": { icon: "timeline", color: "gold" },
  "contract-obligations": { icon: "document-check", color: "violet" },
  "document-comparison": { icon: "compare", color: "rose" },
} as const;

export function specialistIdentity(agentId: string | null | undefined) {
  const known = agentId as keyof typeof identities;
  const identity = identities[known];
  return identity === undefined
    ? { name: t("specialist.task"), icon: "subagent" as const, color: "neutral" }
    : { ...identity, name: t(`specialist.${known}`) };
}

export function specialistStatus(state: AgentRunSummary["state"]) {
  return t(`specialist.${state}`);
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
