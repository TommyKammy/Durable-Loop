/**
 * Phase 2c Bridge: Provider capability detection.
 *
 * Provides a guard that allows supervisor-lifecycle.ts to skip Codex-specific
 * churn tracking when no Codex provider is configured. This enables Phase 4
 * to add OpenCode/Claude Code executors without modifying the lifecycle code.
 *
 * The guard preserves zero-behavior-change for existing Codex deployments:
 * when "codex" is among the configured providers, churn tracking runs as before.
 */

import { configuredReviewProviderKinds } from "../core/review-providers";
import type { SupervisorConfig } from "../core/config-types";

/**
 * Provider capability flags.
 */
export interface ProviderCapabilities {
  /**
   * Whether the configured review provider supports review churn tracking.
   * Currently only the Codex connector has churn tracking logic.
   * Non-Codex providers (OpenCode, Claude Code, custom) will skip churn
   * calculations until provider-specific churn detection is implemented
   * in Phase 3+.
   */
  supportsChurnTracking: boolean;
}

/**
 * Config type needed for capability detection.
 */
type CapabilityConfig = Pick<SupervisorConfig, "reviewBotLogins" | "configuredReviewProviders">;

/**
 * Detect provider capabilities from the supervisor configuration.
 *
 * @param config - Supervisor config with review provider settings
 * @returns Capability flags indicating which features the configured provider supports
 */
export function getProviderCapabilities(config: CapabilityConfig): ProviderCapabilities {
  const kinds = configuredReviewProviderKinds(config);
  return {
    // Only Codex has churn tracking; other providers skip it
    supportsChurnTracking: kinds.includes("codex"),
  };
}
