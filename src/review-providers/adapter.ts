/**
 * Phase 2: ReviewProviderAdapter interface — abstracts provider-specific
 * review-thread logic (identification, severity, fingerprinting, etc.)
 * from Codex-specific implementations.
 */

import type { ReviewThread } from "../core/types";
import type { SupervisorConfig } from "../core/config-types";

/**
 * Severity levels used across providers.
 * Codex uses P0-P3; generic providers map to high/medium/low.
 */
export type ProviderSeverity = "P0" | "P1" | "P2" | "P3" | "high" | "medium" | "low" | null;

/**
 * Provider-neutral adapter for review-thread operations.
 * Each provider (Codex, Copilot, CodeRabbit, custom) implements this interface.
 */
export interface ReviewProviderAdapter {
  /** Provider kind identifier */
  readonly kind: string;

  /**
   * Filter review threads that contain must-fix findings.
   * Must-fix = severity P0/P1/P2 or strong-risk P3 (Codex) /
   * high/medium severity (generic).
   */
  mustFixReviewThreads(reviewThreads: ReviewThread[]): ReviewThread[];

  /**
   * Check if a thread has a finding review comment from this provider.
   */
  hasFindingReviewComment(thread: ReviewThread): boolean;

  /**
   * Get the latest comment node from this provider in the thread.
   */
  latestCommentNode(thread: ReviewThread): ReviewThread["comments"]["nodes"][number] | null;

  /**
   * Get a fingerprint (id or createdAt) for the latest provider comment.
   */
  commentFingerprint(thread: ReviewThread): string | null;

  /**
   * Extract severity from the latest provider comment in the thread.
   */
  extractSeverity(thread: ReviewThread): ProviderSeverity;
}

/**
 * Config type needed by dispatch to select the adapter.
 */
export type ReviewProviderConfig = Pick<SupervisorConfig, "reviewBotLogins" | "configuredReviewProviders">;
