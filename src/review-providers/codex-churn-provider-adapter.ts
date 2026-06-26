/**
 * Phase 3: CodexChurnProviderAdapter
 *
 * Zero-behavior-change wrapper around the 8 Codex-specific churn functions
 * used by supervisor-lifecycle.ts. Delegates every call directly to the
 * original implementation.
 */

import {
  buildCodexConnectorReviewChurnDiagnostic,
  buildCodexConnectorReviewChurnHistory,
  buildCodexConnectorReviewChurnProgressSummary,
  compareCodexConnectorReviewChurnProgress,
  codexConnectorStableSameFileChurnSignature,
  detectStableSameFileCodexConnectorChurn,
  isCodexConnectorStableSameFileChurn,
} from "../codex-connector-review-churn";
import type {
  CodexConnectorReviewChurnDiagnostic,
  CodexConnectorReviewChurnProgressSummary,
  CodexConnectorReviewChurnHistoryEntry,
  CodexConnectorReviewChurnProgressComparison,
  CodexConnectorStableSameFileChurn,
} from "../codex-connector-review-churn";
import type { ReviewThread } from "../core/types";
import type { ChurnProviderAdapter, ChurnAdapterConfig } from "./churn-adapter";

export const codexChurnProviderAdapter: ChurnProviderAdapter = {
  kind: "codex",
  supportsChurnTracking: true,

  buildChurnDiagnostic(
    config: ChurnAdapterConfig,
    reviewThreads: ReviewThread[],
    pr: { headRefOid: string } | null,
  ): CodexConnectorReviewChurnDiagnostic | null {
    // pr is a GitHubPullRequest at the call site; cast to the narrower Pick type
    // expected by the original function.
    return buildCodexConnectorReviewChurnDiagnostic(
      config,
      reviewThreads,
      pr as Parameters<typeof buildCodexConnectorReviewChurnDiagnostic>[2],
    );
  },

  buildChurnProgressSummary(
    diagnostic: CodexConnectorReviewChurnDiagnostic | null,
    headRefOid: string,
  ): CodexConnectorReviewChurnProgressSummary | null {
    if (!diagnostic) {
      return null;
    }
    return buildCodexConnectorReviewChurnProgressSummary(diagnostic, headRefOid);
  },

  buildChurnHistory(args: {
    current: CodexConnectorReviewChurnProgressSummary | null;
    previousProgress: CodexConnectorReviewChurnProgressSummary | null;
    previousHistory: CodexConnectorReviewChurnHistoryEntry[] | null;
  }): CodexConnectorReviewChurnHistoryEntry[] | null {
    if (!args.current) {
      return null;
    }
    return buildCodexConnectorReviewChurnHistory({
      current: args.current,
      previousProgress: args.previousProgress ?? undefined,
      previousHistory: args.previousHistory ?? undefined,
    });
  },

  detectStableSameFileChurn(
    history: CodexConnectorReviewChurnHistoryEntry[] | null,
  ): CodexConnectorStableSameFileChurn | null {
    return detectStableSameFileCodexConnectorChurn(history);
  },

  compareChurnProgress(
    current: CodexConnectorReviewChurnProgressSummary,
    previous: CodexConnectorReviewChurnProgressSummary,
  ): CodexConnectorReviewChurnProgressComparison | null {
    return compareCodexConnectorReviewChurnProgress(current, previous);
  },

  isStableSameFileChurn(value: unknown): value is CodexConnectorStableSameFileChurn {
    return isCodexConnectorStableSameFileChurn(value);
  },

  stableSameFileChurnSignature(stable: CodexConnectorStableSameFileChurn): string {
    return codexConnectorStableSameFileChurnSignature(stable);
  },
};
