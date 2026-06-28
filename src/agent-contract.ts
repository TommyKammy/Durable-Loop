/**
 * Provider-neutral agent turn contract.
 *
 * These types describe the request/result shape exchanged between the
 * supervisor and any executor (Codex/OpenCode/Claude). They live here — above
 * `core/` and the feature modules they reference, but below both `supervisor/`
 * and `executors/` — so the executor layer can depend on the contract without
 * importing the higher-level supervisor module. `supervisor/agent-runner`
 * re-exports them for backward compatibility.
 */

import type {
  BlockedReason,
  FailureContext,
  FailureKind,
  GitHubIssue,
  GitHubPullRequest,
  IssueRunRecord,
  PullRequestCheck,
  ReviewThread,
  RunState,
  SupervisorConfig,
} from "./core/types";
import type { LocalReviewRepairContext } from "./local-review/types";
import type { ExternalReviewMissContext } from "./external-review/external-review-misses";
import type { DeterministicChangeClass } from "./issue-metadata";

export interface AgentRunnerCapabilities {
  supportsResume: boolean;
  supportsStructuredResult: boolean;
}

interface AgentRunnerBaseRequest {
  config: SupervisorConfig;
  workspacePath: string;
  state: RunState;
  record?: Pick<
    IssueRunRecord,
    | "repeated_failure_signature_count"
    | "blocked_verification_retry_count"
    | "timeout_retry_count"
  > &
    Partial<
      Pick<
        IssueRunRecord,
        | "last_failure_signature"
        | "last_tracked_pr_progress_summary"
        | "last_tracked_pr_progress_snapshot"
        | "last_tracked_pr_repeat_failure_decision"
        | "addressing_review_strategy"
        | "addressing_review_strategy_reason"
        | "codex_connector_stable_churn_dossier_consumed_signature"
        | "review_loop_retry_state"
      >
    > | null;
  repoSlug: string;
  issue: GitHubIssue;
  branch: string;
  journalPath: string;
  journalExcerpt?: string | null;
  failureContext?: FailureContext | null;
  previousSummary?: string | null;
  previousError?: string | null;
}

export interface StartAgentTurnContext extends AgentRunnerBaseRequest {
  kind: "start";
  pr: GitHubPullRequest | null;
  checks: PullRequestCheck[];
  reviewThreads: ReviewThread[];
  activeReviewThreads?: ReviewThread[];
  changeClasses?: DeterministicChangeClass[];
  alwaysReadFiles: string[];
  onDemandMemoryFiles: string[];
  gsdEnabled?: boolean;
  gsdPlanningFiles?: string[];
  localReviewRepairContext?: LocalReviewRepairContext | null;
  externalReviewMissContext?: ExternalReviewMissContext | null;
}

export interface ResumeAgentTurnContext extends AgentRunnerBaseRequest {
  kind: "resume";
  sessionId: string;
}

export type AgentTurnContext = StartAgentTurnContext | ResumeAgentTurnContext;
export type AgentTurnRequest = AgentTurnContext;

export interface AgentTurnStructuredResult {
  summary: string;
  stateHint: RunState | null;
  blockedReason: BlockedReason;
  failureSignature: string | null;
  nextAction: string | null;
  tests: string | null;
}

export interface AgentTurnResult {
  exitCode: number;
  sessionId: string | null;
  supervisorMessage: string;
  stderr: string;
  stdout: string;
  // Structured output is only the normalized machine-readable footer from a
  // successful turn. Runner failures must be expressed via failureKind and
  // failureContext instead of mixing both channels.
  structuredResult: AgentTurnStructuredResult | null;
  failureKind: FailureKind;
  failureContext: FailureContext | null;
}

export interface AgentRunner {
  readonly capabilities: AgentRunnerCapabilities;
  runTurn(context: AgentTurnContext): Promise<AgentTurnResult>;
}
