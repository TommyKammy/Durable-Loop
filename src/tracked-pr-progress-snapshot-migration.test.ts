import assert from "node:assert/strict";
import test from "node:test";
import { migrateLegacyChurnSnapshotKeys } from "./tracked-pr-progress-snapshot-migration";

test("migrateLegacyChurnSnapshotKeys maps all legacy churn keys to neutral names and drops legacy", () => {
  const migrated = migrateLegacyChurnSnapshotKeys({
    headRefOid: "h",
    codexConnectorReviewChurnProgress: { a: 1 },
    codexConnectorReviewChurnComparison: { b: 2 },
    codexConnectorReviewChurnHistory: [{ c: 3 }],
    codexConnectorStableSameFileChurn: { d: 4 },
  }) as Record<string, unknown>;

  assert.deepEqual(migrated.reviewChurnProgress, { a: 1 });
  assert.deepEqual(migrated.reviewChurnComparison, { b: 2 });
  assert.deepEqual(migrated.reviewChurnHistory, [{ c: 3 }]);
  assert.deepEqual(migrated.stableSameFileChurn, { d: 4 });
  for (const legacy of [
    "codexConnectorReviewChurnProgress",
    "codexConnectorReviewChurnComparison",
    "codexConnectorReviewChurnHistory",
    "codexConnectorStableSameFileChurn",
  ]) {
    assert.equal(legacy in migrated, false, `${legacy} must be dropped`);
  }
});

test("migrateLegacyChurnSnapshotKeys prefers an already-present neutral key and is idempotent", () => {
  const migrated = migrateLegacyChurnSnapshotKeys({
    reviewChurnProgress: { neutral: true },
    codexConnectorReviewChurnProgress: { legacy: true },
  }) as Record<string, unknown>;
  assert.deepEqual(migrated.reviewChurnProgress, { neutral: true });
  assert.equal("codexConnectorReviewChurnProgress" in migrated, false);

  const alreadyNeutral = migrateLegacyChurnSnapshotKeys({ reviewChurnProgress: { x: 1 } });
  assert.deepEqual(alreadyNeutral, { reviewChurnProgress: { x: 1 } });
});

test("migrateLegacyChurnSnapshotKeys returns non-object inputs unchanged", () => {
  assert.equal(migrateLegacyChurnSnapshotKeys(null), null);
  assert.equal(migrateLegacyChurnSnapshotKeys("not-an-object"), "not-an-object");
});
