/**
 * Phase 2: CodexReviewProviderAdapter — zero-behavior-change wrapper
 * around existing Codex-specific functions in codex-connector-review-policy.ts.
 */

import type { ReviewThread } from "../core/types";
import {
  codexConnectorMustFixReviewThreads,
  hasCodexConnectorFindingReviewComment,
  latestCodexConnectorReviewCommentNode,
  latestCodexConnectorReviewCommentFingerprint,
  latestCodexConnectorPSeverity,
} from "../codex-connector-review-policy";
import type { ReviewProviderAdapter, ProviderSeverity } from "./adapter";

export class CodexReviewProviderAdapter implements ReviewProviderAdapter {
  readonly kind = "codex";

  mustFixReviewThreads(reviewThreads: ReviewThread[]): ReviewThread[] {
    return codexConnectorMustFixReviewThreads(reviewThreads);
  }

  hasFindingReviewComment(thread: ReviewThread): boolean {
    return hasCodexConnectorFindingReviewComment(thread);
  }

  latestCommentNode(thread: ReviewThread): ReviewThread["comments"]["nodes"][number] | null {
    return latestCodexConnectorReviewCommentNode(thread);
  }

  commentFingerprint(thread: ReviewThread): string | null {
    return latestCodexConnectorReviewCommentFingerprint(thread);
  }

  extractSeverity(thread: ReviewThread): ProviderSeverity {
    return latestCodexConnectorPSeverity(thread);
  }
}
