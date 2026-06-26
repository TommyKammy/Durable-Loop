/**
 * Phase 3: ChurnProviderAdapter — abstracts churn tracking logic
 * from Codex-specific implementations.
 *
 * The adapter wraps the 8 churn functions used by supervisor-lifecycle.ts:
 * - buildCodexConnectorReviewChurnDiagnostic
 * - buildCodexConnectorReviewChurnProgressSummary
 * - buildCodexConnectorReviewChurnHistory
 * - detectStableSameFileCodexConnectorChurn
 * - compareCodexConnectorReviewChurnProgress
 * - isCodexConnectorStableSameFileChurn
 * - codexConnectorStableSameFileChurnSignature
 *
 * Snapshot field names are preserved for serialization compatibility.
 * Phase 4 can add OpenCode/Claude churn adapters implementing this interface.
 */

import type { ReviewThread } from "../core/types";
import type { SupervisorConfig } from "../core/config-types";
import type {
  CodexConnectorReviewChurnDiagnostic,
  CodexConnectorReviewChurnProgressSummary,
  CodexConnectorReviewChurnHistoryEntry,
  CodexConnectorReviewChurnProgressComparison,
  CodexConnectorStableSameFileChurn,
} from "../codex-connector-review-churn";
import { getProviderCapabilities, type ProviderCapabilities } from "./provider-capabilities";
import { codexChurnProviderAdapter } from "./codex-churn-provider-adapter";
import { nullChurnProviderAdapter } from "./null-churn-provider-adapter";

/**
 * Config type needed by churn adapters.
 */
export type ChurnAdapterConfig = Pick<
  SupervisorConfig,
  | "configuredReviewProviders"
  | "reviewBotLogins"
  | "codexConnectorReviewChurnMustFixThreshold"
  | "codexConnectorReviewChurnFileConcentrationPercent"
>;

/**
 * Provider-neutral churn adapter interface.
 *
 * Each method returns null/empty when the provider does not support
 * that particular churn operation. The NullChurnProviderAdapter returns
 * null for everything, making the non-Codex behavior explicit.
 */
export interface ChurnProviderAdapter {
  /** Provider kind identifier */
  readonly kind: string;

  /** Whether this adapter supports churn tracking at all */
  readonly supportsChurnTracking: boolean;

  /**
   * Build a churn diagnostic from review threads and PR data.
   * Returns null when churn tracking is not supported.
   */
  buildChurnDiagnostic(
    config: ChurnAdapterConfig,
    reviewThreads: ReviewThread[],
    pr: { headRefOid: string } | null,
  ): CodexConnectorReviewChurnDiagnostic | null;

  /**
   * Build a progress summary from a churn diagnostic.
   * Returns null when input is null or churn tracking is not supported.
   */
  buildChurnProgressSummary(
    diagnostic: CodexConnectorReviewChurnDiagnostic | null,
    headRefOid: string,
  ): CodexConnectorReviewChurnProgressSummary | null;

  /**
   * Build churn history from current progress and previous state.
   * Returns null when input is null or churn tracking is not supported.
   */
  buildChurnHistory(args: {
    current: CodexConnectorReviewChurnProgressSummary | null;
    previousProgress: CodexConnectorReviewChurnProgressSummary | null;
    previousHistory: CodexConnectorReviewChurnHistoryEntry[] | null;
  }): CodexConnectorReviewChurnHistoryEntry[] | null;

  /**
   * Detect stable same-file churn from history.
   * Returns null when input is null or churn tracking is not supported.
   */
  detectStableSameFileChurn(
    history: CodexConnectorReviewChurnHistoryEntry[] | null,
  ): CodexConnectorStableSameFileChurn | null;

  /**
   * Compare current and previous churn progress.
   * Returns null when either input is null or churn tracking is not supported.
   */
  compareChurnProgress(
    current: CodexConnectorReviewChurnProgressSummary,
    previous: CodexConnectorReviewChurnProgressSummary,
  ): CodexConnectorReviewChurnProgressComparison | null;

  /**
   * Type guard for stable same-file churn values.
   */
  isStableSameFileChurn(value: unknown): value is CodexConnectorStableSameFileChurn;

  /**
   * Generate a signature for a stable same-file churn value.
   * Returns null when the value is not a valid stable churn.
   */
  stableSameFileChurnSignature(
    stable: CodexConnectorStableSameFileChurn,
  ): string;
}

/**
 * Select the appropriate churn adapter based on provider capabilities.
 *
 * When the configured provider supports churn tracking (currently only Codex),
 * returns the CodexChurnProviderAdapter. Otherwise returns the
 * NullChurnProviderAdapter which no-ops all churn operations.
 *
 * @param config - Supervisor config with review provider settings
 * @returns The appropriate ChurnProviderAdapter for the configured provider
 */
export function selectChurnAdapter(
  config: Pick<SupervisorConfig, "reviewBotLogins" | "configuredReviewProviders">,
): ChurnProviderAdapter {
  const capabilities: ProviderCapabilities = getProviderCapabilities(config);
  return capabilities.supportsChurnTracking ? codexChurnProviderAdapter : nullChurnProviderAdapter;
}
