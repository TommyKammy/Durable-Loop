/**
 * Phase 2: GenericReviewProviderAdapter — handles non-Codex providers
 * (Copilot, CodeRabbit, custom) using keyword-based heuristics.
 */

import type { ReviewThread } from "../core/types";
import { configuredReviewBotLogins } from "../core/review-providers";
import type { SupervisorConfig } from "../core/config-types";
import type { ReviewProviderAdapter, ProviderSeverity, ReviewProviderConfig } from "./adapter";

/**
 * Keywords that indicate must-fix severity in generic review comments.
 */
const MUST_FIX_KEYWORDS = [
  "must fix",
  "blocking",
  "critical",
  "bug",
  "security",
  "vulnerability",
  "error:",
  "incorrect",
  "broken",
] as const;

const HIGH_SEVERITY_KEYWORDS = ["critical", "security", "vulnerability", "bug", "broken"] as const;
const MEDIUM_SEVERITY_KEYWORDS = ["must fix", "blocking", "error:", "incorrect"] as const;

/**
 * Check if a comment body contains any of the keywords.
 */
function bodyContainsKeyword(body: string, keywords: readonly string[]): boolean {
  const lower = body.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

/**
 * Determine if a thread is a must-fix for a generic provider.
 * Uses keyword heuristics on the latest comment from a configured bot.
 */
function isGenericMustFixThread(
  config: ReviewProviderConfig,
  thread: ReviewThread,
): boolean {
  if (thread.isResolved || thread.isOutdated) {
    return false;
  }

  const botLogins = new Set(configuredReviewBotLogins(config));
  const comments = thread.comments.nodes;

  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const comment = comments[index];
    const login = comment.author?.login;
    if (!login || !botLogins.has(login.toLowerCase())) {
      continue;
    }

    if (bodyContainsKeyword(comment.body, MUST_FIX_KEYWORDS)) {
      return true;
    }
    break; // Only check the latest comment from a configured bot
  }

  return false;
}

export class GenericReviewProviderAdapter implements ReviewProviderAdapter {
  readonly kind: string;
  private readonly config: ReviewProviderConfig;

  constructor(kind: string, config: ReviewProviderConfig) {
    this.kind = kind;
    this.config = config;
  }

  mustFixReviewThreads(reviewThreads: ReviewThread[]): ReviewThread[] {
    return reviewThreads.filter((thread) => isGenericMustFixThread(this.config, thread));
  }

  hasFindingReviewComment(thread: ReviewThread): boolean {
    const botLogins = new Set(configuredReviewBotLogins(this.config));
    const comments = thread.comments.nodes;
    for (let index = comments.length - 1; index >= 0; index -= 1) {
      const comment = comments[index];
      const login = comment.author?.login;
      if (login && botLogins.has(login.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  latestCommentNode(thread: ReviewThread): ReviewThread["comments"]["nodes"][number] | null {
    const botLogins = new Set(configuredReviewBotLogins(this.config));
    const comments = thread.comments.nodes;
    for (let index = comments.length - 1; index >= 0; index -= 1) {
      const comment = comments[index];
      const login = comment.author?.login;
      if (login && botLogins.has(login.toLowerCase())) {
        return comment;
      }
    }
    return null;
  }

  commentFingerprint(thread: ReviewThread): string | null {
    const node = this.latestCommentNode(thread);
    return node?.id || node?.createdAt || null;
  }

  extractSeverity(thread: ReviewThread): ProviderSeverity {
    const node = this.latestCommentNode(thread);
    if (!node) {
      return null;
    }
    if (bodyContainsKeyword(node.body, HIGH_SEVERITY_KEYWORDS)) {
      return "high";
    }
    if (bodyContainsKeyword(node.body, MEDIUM_SEVERITY_KEYWORDS)) {
      return "medium";
    }
    return "low";
  }
}
