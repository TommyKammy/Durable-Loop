/**
 * Phase 2: Dispatch — neutral wrapper functions that select the appropriate
 * ReviewProviderAdapter based on configuration.
 *
 * These wrappers allow call-sites to use provider-neutral function names
 * instead of Codex-specific ones, enabling Phase 4 to add OpenCode/Claude
 * support without modifying call-sites.
 */

import type { ReviewThread } from "../core/types";
import { configuredReviewProviderKinds } from "../core/review-providers";
import type { ReviewProviderAdapter, ProviderSeverity, ReviewProviderConfig } from "./adapter";
import { CodexReviewProviderAdapter } from "./codex-review-provider-adapter";
import { GenericReviewProviderAdapter } from "./generic-adapter";

// Singleton Codex adapter — zero-behavior-change wrapper
const codexAdapter = new CodexReviewProviderAdapter();

/**
 * Select the appropriate adapter for the given configuration.
 * If "codex" is among the configured providers, use the Codex adapter.
 * Otherwise, use a generic adapter for the first non-codex provider.
 */
export function selectAdapter(config: ReviewProviderConfig): ReviewProviderAdapter {
  const kinds = configuredReviewProviderKinds(config);
  if (kinds.includes("codex")) {
    return codexAdapter;
  }
  // Use the first non-codex provider kind
  const firstKind = kinds.find((k) => k !== "codex") ?? "generic";
  return new GenericReviewProviderAdapter(firstKind, config);
}

// ===== Neutral wrapper functions =====

/**
 * Filter review threads that contain must-fix findings.
 * Neutral wrapper for codexConnectorMustFixReviewThreads.
 */
export function mustFixReviewThreads(
  config: ReviewProviderConfig,
  reviewThreads: ReviewThread[],
): ReviewThread[] {
  return selectAdapter(config).mustFixReviewThreads(reviewThreads);
}

/**
 * Check if a thread has a finding review comment from the configured provider.
 * Neutral wrapper for hasCodexConnectorFindingReviewComment.
 */
export function hasProviderFindingReviewComment(
  config: ReviewProviderConfig,
  thread: ReviewThread,
): boolean {
  return selectAdapter(config).hasFindingReviewComment(thread);
}

/**
 * Get the latest comment node from the configured provider in the thread.
 * Neutral wrapper for latestCodexConnectorReviewCommentNode.
 */
export function providerCommentNode(
  config: ReviewProviderConfig,
  thread: ReviewThread,
): ReviewThread["comments"]["nodes"][number] | null {
  return selectAdapter(config).latestCommentNode(thread);
}

/**
 * Get a fingerprint for the latest provider comment in the thread.
 * Neutral wrapper for latestCodexConnectorReviewCommentFingerprint.
 */
export function providerCommentFingerprint(
  config: ReviewProviderConfig,
  thread: ReviewThread,
): string | null {
  return selectAdapter(config).commentFingerprint(thread);
}

/**
 * Extract severity from the latest provider comment in the thread.
 * Neutral wrapper for latestCodexConnectorPSeverity.
 */
export function providerExtractSeverity(
  config: ReviewProviderConfig,
  thread: ReviewThread,
): ProviderSeverity {
  return selectAdapter(config).extractSeverity(thread);
}
