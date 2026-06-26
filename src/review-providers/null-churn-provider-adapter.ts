/**
 * Phase 3: NullChurnProviderAdapter
 *
 * Returns null/empty for all churn operations. Used when the configured
 * review provider does not support churn tracking (e.g. OpenCode, Claude Code,
 * custom providers). Makes the non-Codex behavior explicit rather than
 * relying on implicit undefined checks.
 */

import type {
  CodexConnectorReviewChurnDiagnostic,
  CodexConnectorReviewChurnProgressSummary,
  CodexConnectorReviewChurnHistoryEntry,
  CodexConnectorReviewChurnProgressComparison,
  CodexConnectorStableSameFileChurn,
} from "../codex-connector-review-churn";
import type { ReviewThread } from "../core/types";
import type { ChurnProviderAdapter, ChurnAdapterConfig } from "./churn-adapter";

export const nullChurnProviderAdapter: ChurnProviderAdapter = {
  kind: "none",
  supportsChurnTracking: false,

  buildChurnDiagnostic(
    _config: ChurnAdapterConfig,
    _reviewThreads: ReviewThread[],
    _pr: { headRefOid: string } | null,
  ): CodexConnectorReviewChurnDiagnostic | null {
    return null;
  },

  buildChurnProgressSummary(
    _diagnostic: CodexConnectorReviewChurnDiagnostic | null,
    _headRefOid: string,
  ): CodexConnectorReviewChurnProgressSummary | null {
    return null;
  },

  buildChurnHistory(_args: {
    current: CodexConnectorReviewChurnProgressSummary | null;
    previousProgress: CodexConnectorReviewChurnProgressSummary | null;
    previousHistory: CodexConnectorReviewChurnHistoryEntry[] | null;
  }): CodexConnectorReviewChurnHistoryEntry[] | null {
    return null;
  },

  detectStableSameFileChurn(
    _history: CodexConnectorReviewChurnHistoryEntry[] | null,
  ): CodexConnectorStableSameFileChurn | null {
    return null;
  },

  compareChurnProgress(
    _current: CodexConnectorReviewChurnProgressSummary,
    _previous: CodexConnectorReviewChurnProgressSummary,
  ): CodexConnectorReviewChurnProgressComparison | null {
    return null;
  },

  isStableSameFileChurn(_value: unknown): _value is CodexConnectorStableSameFileChurn {
    return false;
  },

  stableSameFileChurnSignature(_stable: CodexConnectorStableSameFileChurn): string {
    return "";
  },
};
