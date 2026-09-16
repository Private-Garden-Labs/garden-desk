import type { AgentRunState } from "@gardendesk/shared";

const pollIntervalMs = 250;

export interface FirstActionRunCore {
  cancelAgent(jobId: string): Promise<boolean>;
  getAgentRun(runId: string): Promise<{ run: { state: AgentRunState } }>;
  close(): Promise<void>;
}

export interface FirstActionStartedRun {
  id: string;
  jobId: string;
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForTerminal(
  core: FirstActionRunCore,
  runId: string,
  deadline: number,
): Promise<void> {
  while (Date.now() < deadline) {
    const snapshot = await core.getAgentRun(runId);
    if (snapshot.run.state !== "queued" && snapshot.run.state !== "running") return;
    await pause(pollIntervalMs);
  }
  throw new Error("The case did not stop within its three-minute limit.");
}

export async function closeFirstActionCase(
  core: FirstActionRunCore,
  started: FirstActionStartedRun | undefined,
  deadline: number,
): Promise<void> {
  try {
    if (started !== undefined) {
      await core.cancelAgent(started.jobId);
      await waitForTerminal(core, started.id, deadline);
    }
  } finally {
    await core.close();
  }
}
