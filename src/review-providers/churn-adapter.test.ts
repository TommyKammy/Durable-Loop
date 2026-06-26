/**
 * Phase 3: Tests for ChurnProviderAdapter dispatch and adapter behavior.
 *
 * Verifies:
 * - selectChurnAdapter returns CodexChurnProviderAdapter for Codex configs
 * - selectChurnAdapter returns NullChurnProviderAdapter for non-Codex configs
 * - CodexChurnProviderAdapter delegates to original functions (behavioral parity)
 * - NullChurnProviderAdapter returns null/false for all operations
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { selectChurnAdapter } from "./churn-adapter";
import { codexChurnProviderAdapter } from "./codex-churn-provider-adapter";
import { nullChurnProviderAdapter } from "./null-churn-provider-adapter";
import type { SupervisorConfig } from "../core/config-types";
import type { ReviewThread } from "../core/types";

function createConfig(
  overrides: Partial<Pick<SupervisorConfig, "reviewBotLogins" | "configuredReviewProviders">> = {},
): Pick<SupervisorConfig, "reviewBotLogins" | "configuredReviewProviders"> {
  return {
    reviewBotLogins: ["chatgpt-codex-connector[bot]"],
    configuredReviewProviders: [
      { kind: "codex", reviewerLogins: ["chatgpt-codex-connector[bot]"], signalSource: "review_threads" },
    ],
    ...overrides,
  };
}

function createNonCodexConfig(): Pick<SupervisorConfig, "reviewBotLogins" | "configuredReviewProviders"> {
  return {
    reviewBotLogins: ["coderabbitai[bot]"],
    configuredReviewProviders: [
      { kind: "custom", reviewerLogins: ["coderabbitai[bot]"], signalSource: "review_threads" },
    ],
  };
}

describe("selectChurnAdapter", () => {
  test("returns CodexChurnProviderAdapter when Codex provider is configured", () => {
    const adapter = selectChurnAdapter(createConfig());
    assert.equal(adapter.kind, "codex");
    assert.equal(adapter.supportsChurnTracking, true);
  });

  test("returns NullChurnProviderAdapter when no Codex provider is configured", () => {
    const adapter = selectChurnAdapter(createNonCodexConfig());
    assert.equal(adapter.kind, "none");
    assert.equal(adapter.supportsChurnTracking, false);
  });

  test("returns NullChurnProviderAdapter when no providers are configured", () => {
    const adapter = selectChurnAdapter({
      reviewBotLogins: [],
      configuredReviewProviders: [],
    });
    assert.equal(adapter.kind, "none");
    assert.equal(adapter.supportsChurnTracking, false);
  });
});

describe("codexChurnProviderAdapter", () => {
  test("buildChurnDiagnostic returns null when no Codex must-fix threads exist", () => {
    const config = createConfig() as ChurnAdapterConfig;
    const result = codexChurnProviderAdapter.buildChurnDiagnostic(config, [], null);
    assert.equal(result, null);
  });

  test("buildChurnProgressSummary returns null when diagnostic is null", () => {
    const result = codexChurnProviderAdapter.buildChurnProgressSummary(null, "head-abc");
    assert.equal(result, null);
  });

  test("buildChurnHistory returns null when current progress is null", () => {
    const result = codexChurnProviderAdapter.buildChurnHistory({
      current: null,
      previousProgress: null,
      previousHistory: null,
    });
    assert.equal(result, null);
  });

  test("detectStableSameFileChurn returns null for null history", () => {
    const result = codexChurnProviderAdapter.detectStableSameFileChurn(null);
    assert.equal(result, null);
  });

  test("detectStableSameFileChurn returns null for empty history", () => {
    const result = codexChurnProviderAdapter.detectStableSameFileChurn([]);
    assert.equal(result, null);
  });

  test("isStableSameFileChurn returns false for non-object values", () => {
    assert.equal(codexChurnProviderAdapter.isStableSameFileChurn(null), false);
    assert.equal(codexChurnProviderAdapter.isStableSameFileChurn(undefined), false);
    assert.equal(codexChurnProviderAdapter.isStableSameFileChurn("string"), false);
    assert.equal(codexChurnProviderAdapter.isStableSameFileChurn(42), false);
  });

  test("isStableSameFileChurn returns false for incomplete objects", () => {
    assert.equal(codexChurnProviderAdapter.isStableSameFileChurn({}), false);
    assert.equal(
      codexChurnProviderAdapter.isStableSameFileChurn({ streak: 2 }),
      false,
    );
  });

  test("isStableSameFileChurn returns true for valid stable churn objects", () => {
    const valid = {
      streak: 2,
      dominantFile: "src/index.ts",
      clusterCategorySignature: "category_a",
      currentEffectiveMustFixCount: 3,
      reviewedHeadShas: ["head-1", "head-2"],
      representativeThreadIds: ["thread-1", "thread-2"],
    };
    assert.equal(codexChurnProviderAdapter.isStableSameFileChurn(valid), true);
  });

  test("stableSameFileChurnSignature produces a structured signature string", () => {
    const stable = {
      streak: 2,
      dominantFile: "src/index.ts",
      clusterCategorySignature: "category_a",
      currentEffectiveMustFixCount: 3,
      reviewedHeadShas: ["head-1", "head-2"],
      representativeThreadIds: ["thread-1", "thread-2"],
    };
    const sig = codexChurnProviderAdapter.stableSameFileChurnSignature(stable);
    assert.ok(sig.startsWith("codex-connector-stable-same-file-churn:"));
    assert.ok(sig.includes("src/index.ts"));
    assert.ok(sig.includes("head-1_head-2"));
  });
});

describe("nullChurnProviderAdapter", () => {
  test("kind is 'none' and supportsChurnTracking is false", () => {
    assert.equal(nullChurnProviderAdapter.kind, "none");
    assert.equal(nullChurnProviderAdapter.supportsChurnTracking, false);
  });

  test("buildChurnDiagnostic always returns null", () => {
    const result = nullChurnProviderAdapter.buildChurnDiagnostic(
      {} as ChurnAdapterConfig,
      [],
      { headRefOid: "head-abc" },
    );
    assert.equal(result, null);
  });

  test("buildChurnProgressSummary always returns null", () => {
    const result = nullChurnProviderAdapter.buildChurnProgressSummary(
      null,
      "head-abc",
    );
    assert.equal(result, null);
  });

  test("buildChurnHistory always returns null", () => {
    const result = nullChurnProviderAdapter.buildChurnHistory({
      current: null,
      previousProgress: null,
      previousHistory: null,
    });
    assert.equal(result, null);
  });

  test("detectStableSameFileChurn always returns null", () => {
    assert.equal(nullChurnProviderAdapter.detectStableSameFileChurn(null), null);
    assert.equal(nullChurnProviderAdapter.detectStableSameFileChurn([]), null);
  });

  test("compareChurnProgress always returns null", () => {
    const result = nullChurnProviderAdapter.compareChurnProgress(
      {} as never,
      {} as never,
    );
    assert.equal(result, null);
  });

  test("isStableSameFileChurn always returns false", () => {
    assert.equal(nullChurnProviderAdapter.isStableSameFileChurn(null), false);
    assert.equal(nullChurnProviderAdapter.isStableSameFileChurn({}), false);
  });

  test("stableSameFileChurnSignature returns empty string", () => {
    const result = nullChurnProviderAdapter.stableSameFileChurnSignature(
      {} as never,
    );
    assert.equal(result, "");
  });
});

// Type alias for test convenience
type ChurnAdapterConfig = import("./churn-adapter").ChurnAdapterConfig;
