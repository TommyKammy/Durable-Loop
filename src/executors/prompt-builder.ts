/**
 * Phase 5: Provider-neutral prompt builder implementations.
 *
 * Provides two PromptBuilder implementations:
 * - CodexPromptBuilder: passthrough to buildCodexPrompt (zero behavior change)
 * - GenericPromptBuilder: wraps buildCodexPrompt with provider-neutral language
 *
 * The labeled footer format (Summary, State hint, Blocked reason, etc.) is
 * identical across all builders. Only the provider-specific phrases in the
 * prompt body are substituted by GenericPromptBuilder.
 *
 * Replacements performed by GenericPromptBuilder (5 unguarded phrases):
 * 1. "Codex Working Notes" → "<provider> Working Notes"
 * 2. "existing Codex session" → "existing <provider> session"
 * 3. "shared by Codex, CI agents" → "shared by <provider>, CI agents"
 * 4. "Previous Codex summary" → "Previous <provider> summary"
 *
 * Guarded "Codex Connector" phrases are NOT replaced — they refer to the
 * review-provider system, not the executor identity, and are only emitted
 * when a Codex review provider is configured.
 */

import { buildCodexPrompt } from "../codex";
import type { AgentTurnContext } from "../supervisor/agent-runner";
import type { PromptBuilder, ExecutorKind } from "./types";

/**
 * Codex prompt builder — direct passthrough to buildCodexPrompt.
 *
 * Maintains exact backward compatibility with the existing Codex executor.
 * Used by CodexExecutor and createCodexAgentRunner.
 */
export class CodexPromptBuilder implements PromptBuilder {
  buildPrompt(context: AgentTurnContext): string {
    return buildCodexPrompt(context);
  }
}

/**
 * Generic prompt builder — wraps buildCodexPrompt with provider-neutral language.
 *
 * Calls buildCodexPrompt and then replaces the 5 unguarded Codex-specific
 * phrases with the provider name. The labeled footer format is preserved
 * exactly — only the prompt body language changes.
 *
 * Used by OpenCodeExecutor and ClaudeCodeExecutor.
 */
export class GenericPromptBuilder implements PromptBuilder {
  private readonly providerName: string;

  constructor(providerName: string) {
    this.providerName = providerName;
  }

  buildPrompt(context: AgentTurnContext): string {
    const prompt = buildCodexPrompt(context);
    return this.replaceProviderPhrases(prompt);
  }

  /**
   * Replace the 5 unguarded Codex-specific phrases with the provider name.
   *
   * These replacements are safe because:
   * - "Codex Working Notes" is a unique phrase that doesn't appear in the
   *   labeled footer or in Codex Connector sections
   * - "existing Codex session" only appears in the resume prompt header
   * - "shared by Codex, CI agents" only appears in the memory policy section
   * - "Previous Codex summary" only appears in the journal excerpt section
   *
   * "Codex Connector" phrases are deliberately NOT replaced because they
   * refer to the review-provider system, not the executor identity.
   */
  private replaceProviderPhrases(prompt: string): string {
    return prompt
      // 1. "Codex Working Notes" → "<provider> Working Notes"
      .replace(/Codex Working Notes/g, `${this.providerName} Working Notes`)
      // 2. "existing Codex session" → "existing <provider> session"
      .replace(/existing Codex session/g, `existing ${this.providerName} session`)
      // 3. "shared by Codex, CI agents" → "shared by <provider>, CI agents"
      .replace(/shared by Codex, CI agents/g, `shared by ${this.providerName}, CI agents`)
      // 4. "Previous Codex summary" → "Previous <provider> summary"
      .replace(/Previous Codex summary/g, `Previous ${this.providerName} summary`);
  }
}

/**
 * Factory that creates the appropriate PromptBuilder for an executor kind.
 *
 * - "codex" → CodexPromptBuilder (passthrough, zero behavior change)
 * - "opencode" → GenericPromptBuilder("OpenCode")
 * - "claude" → GenericPromptBuilder("Claude Code")
 * - "mock" → CodexPromptBuilder (mock executor doesn't build prompts)
 *
 * @param kind - The executor kind
 * @returns The appropriate PromptBuilder
 */
export function createPromptBuilder(kind: ExecutorKind): PromptBuilder {
  switch (kind) {
    case "codex":
      return new CodexPromptBuilder();
    case "opencode":
      return new GenericPromptBuilder("OpenCode");
    case "claude":
      return new GenericPromptBuilder("Claude Code");
    case "mock":
      // Mock executor doesn't call buildPrompt, but return a passthrough
      // for consistency
      return new CodexPromptBuilder();
    default: {
      const _exhaustive: never = kind;
      throw new Error(`createPromptBuilder: unknown executor kind "${String(_exhaustive)}"`);
    }
  }
}
