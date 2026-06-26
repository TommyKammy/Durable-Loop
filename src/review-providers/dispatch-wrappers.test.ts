/**
 * Phase 2c: Tests for neutral dispatch wrapper functions.
 * Verifies that wrappers correctly dispatch to Codex or Generic adapters
 * based on configuration.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { ReviewThread, SupervisorConfig } from "../core/types";
import {
  mustFixReviewThreads,
  providerCommentFingerprint,
  providerExtractSeverity,
  hasProviderFindingReviewComment,
  providerCommentNode,
  selectAdapter,
} from "./dispatch";
import { CodexReviewProviderAdapter } from "./codex-review-provider-adapter";

function createThread(overrides: Partial<ReviewThread> = {}): ReviewThread {
  return {
    id: "thread-1",
    isResolved: false,
    isOutdated: false,
    path: "src/index.ts",
    line: 10,
    comments: {
      nodes: [
        {
          id: "comment-1",
          body: "P1: This is a critical bug.",
          createdAt: "2025-01-01T00:00:00Z",
          url: "https://github.com/owner/repo/pull/1#discussion_r1",
          author: { login: "chatgpt-codex-connector", typeName: "User" },
        },
      ],
    },
    ...overrides,
  } as ReviewThread;
}

function createCodexConfig(overrides: Partial<SupervisorConfig> = {}): Pick<SupervisorConfig, "reviewBotLogins" | "configuredReviewProviders"> {
  return {
    reviewBotLogins: ["chatgpt-codex-connector"],
    configuredReviewProviders: [
      { kind: "codex", reviewerLogins: ["chatgpt-codex-connector"], signalSource: "review_threads" },
    ],
    ...overrides,
  };
}

function createGenericConfig(): Pick<SupervisorConfig, "reviewBotLogins" | "configuredReviewProviders"> {
  return {
    reviewBotLogins: ["my-custom-bot"],
    configuredReviewProviders: [
      { kind: "custom", reviewerLogins: ["my-custom-bot"], signalSource: "review_threads" },
    ],
  };
}

test("selectAdapter returns CodexReviewProviderAdapter for codex config", () => {
  const adapter = selectAdapter(createCodexConfig());
  assert.equal(adapter.kind, "codex");
  assert.ok(adapter instanceof CodexReviewProviderAdapter);
});

test("selectAdapter returns generic adapter for non-codex config", () => {
  const adapter = selectAdapter(createGenericConfig());
  assert.equal(adapter.kind, "custom");
  assert.ok(!(adapter instanceof CodexReviewProviderAdapter));
});

test("mustFixReviewThreads with codex config filters P1 threads", () => {
  const threads = [createThread()];
  const result = mustFixReviewThreads(createCodexConfig(), threads);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "thread-1");
});

test("mustFixReviewThreads with codex config filters P0 threads", () => {
  const threads = [createThread({
    comments: {
      nodes: [{
        id: "c1", body: "P0: Security vulnerability", createdAt: "2025-01-01T00:00:00Z",
        url: "u", author: { login: "chatgpt-codex-connector", typeName: "User" },
      }],
    },
  })];
  const result = mustFixReviewThreads(createCodexConfig(), threads);
  assert.equal(result.length, 1);
});

test("mustFixReviewThreads with codex config excludes resolved threads", () => {
  const threads = [createThread({ isResolved: true })];
  const result = mustFixReviewThreads(createCodexConfig(), threads);
  assert.equal(result.length, 0);
});

test("mustFixReviewThreads with codex config excludes outdated threads", () => {
  const threads = [createThread({ isOutdated: true })];
  const result = mustFixReviewThreads(createCodexConfig(), threads);
  assert.equal(result.length, 0);
});

test("mustFixReviewThreads with codex config excludes non-codex comments", () => {
  const threads = [createThread({
    comments: {
      nodes: [{
        id: "c1", body: "P1: bug", createdAt: "2025-01-01T00:00:00Z",
        url: "u", author: { login: "random-user", typeName: "User" },
      }],
    },
  })];
  const result = mustFixReviewThreads(createCodexConfig(), threads);
  assert.equal(result.length, 0);
});

test("mustFixReviewThreads with generic config uses keyword heuristics", () => {
  const threads = [createThread({
    comments: {
      nodes: [{
        id: "c1", body: "This is a critical bug that must be fixed", createdAt: "2025-01-01T00:00:00Z",
        url: "u", author: { login: "my-custom-bot", typeName: "User" },
      }],
    },
  })];
  const result = mustFixReviewThreads(createGenericConfig(), threads);
  assert.equal(result.length, 1);
});

test("mustFixReviewThreads with generic config excludes non-matching keywords", () => {
  const threads = [createThread({
    comments: {
      nodes: [{
        id: "c1", body: "Looks good to me!", createdAt: "2025-01-01T00:00:00Z",
        url: "u", author: { login: "my-custom-bot", typeName: "User" },
      }],
    },
  })];
  const result = mustFixReviewThreads(createGenericConfig(), threads);
  assert.equal(result.length, 0);
});

test("providerCommentFingerprint with codex config returns comment id", () => {
  const thread = createThread();
  const fingerprint = providerCommentFingerprint(createCodexConfig(), thread);
  assert.equal(fingerprint, "comment-1");
});

test("providerCommentFingerprint with codex config returns null for non-codex thread", () => {
  const thread = createThread({
    comments: {
      nodes: [{
        id: "c1", body: "test", createdAt: "2025-01-01T00:00:00Z",
        url: "u", author: { login: "random-user", typeName: "User" },
      }],
    },
  });
  const fingerprint = providerCommentFingerprint(createCodexConfig(), thread);
  assert.equal(fingerprint, null);
});

test("providerExtractSeverity with codex config returns P1", () => {
  const thread = createThread();
  const severity = providerExtractSeverity(createCodexConfig(), thread);
  assert.equal(severity, "P1");
});

test("providerExtractSeverity with codex config returns null for non-codex thread", () => {
  const thread = createThread({
    comments: {
      nodes: [{
        id: "c1", body: "test", createdAt: "2025-01-01T00:00:00Z",
        url: "u", author: { login: "random-user", typeName: "User" },
      }],
    },
  });
  const severity = providerExtractSeverity(createCodexConfig(), thread);
  assert.equal(severity, null);
});

test("hasProviderFindingReviewComment with codex config returns true for codex thread", () => {
  const thread = createThread();
  assert.equal(hasProviderFindingReviewComment(createCodexConfig(), thread), true);
});

test("hasProviderFindingReviewComment with codex config returns false for non-codex thread", () => {
  const thread = createThread({
    comments: {
      nodes: [{
        id: "c1", body: "test", createdAt: "2025-01-01T00:00:00Z",
        url: "u", author: { login: "random-user", typeName: "User" },
      }],
    },
  });
  assert.equal(hasProviderFindingReviewComment(createCodexConfig(), thread), false);
});

test("providerCommentNode with codex config returns comment node", () => {
  const thread = createThread();
  const node = providerCommentNode(createCodexConfig(), thread);
  assert.ok(node);
  assert.equal(node?.id, "comment-1");
});

test("providerCommentNode with codex config returns null for non-codex thread", () => {
  const thread = createThread({
    comments: {
      nodes: [{
        id: "c1", body: "test", createdAt: "2025-01-01T00:00:00Z",
        url: "u", author: { login: "random-user", typeName: "User" },
      }],
    },
  });
  const node = providerCommentNode(createCodexConfig(), thread);
  assert.equal(node, null);
});

test("mustFixReviewThreads with empty config returns empty for codex adapter", () => {
  const config = { reviewBotLogins: [], configuredReviewProviders: [] };
  // No codex provider configured, so generic adapter is used
  const result = mustFixReviewThreads(config, [createThread()]);
  assert.equal(result.length, 0);
});

test("mustFixReviewThreads handles empty thread array", () => {
  assert.equal(mustFixReviewThreads(createCodexConfig(), []).length, 0);
  assert.equal(mustFixReviewThreads(createGenericConfig(), []).length, 0);
});

test("providerCommentFingerprint handles empty comments", () => {
  const thread = createThread({ comments: { nodes: [] } });
  assert.equal(providerCommentFingerprint(createCodexConfig(), thread), null);
});
