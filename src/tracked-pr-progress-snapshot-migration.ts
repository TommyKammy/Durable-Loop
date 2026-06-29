/**
 * Read-time migration for persisted `TrackedPrProgressSnapshot` strings.
 *
 * The churn snapshot fields were renamed from the Codex-specific
 * `codexConnector*` names to executor-neutral names. The snapshot JSON
 * (`last_tracked_pr_progress_snapshot`) is parsed in several places, so EVERY
 * consumer that `JSON.parse`s it must run this migration — otherwise a snapshot
 * persisted before the rename would read `undefined` for the renamed keys and
 * silently drop churn data (lost dossier guidance, lost status comments).
 *
 * The map is idempotent: legacy keys are mapped onto the canonical keys
 * (preferring an already-present canonical value) and then removed, so a snapshot
 * that already uses the neutral keys is left unchanged.
 */
const LEGACY_CHURN_SNAPSHOT_KEY_MAP: Record<string, string> = {
  codexConnectorReviewChurnProgress: "reviewChurnProgress",
  codexConnectorReviewChurnComparison: "reviewChurnComparison",
  codexConnectorReviewChurnHistory: "reviewChurnHistory",
  codexConnectorStableSameFileChurn: "stableSameFileChurn",
};

/**
 * Map legacy `codexConnector*` churn keys on a parsed snapshot object onto the
 * neutral keys, mutating and returning the same value. Non-object inputs are
 * returned unchanged. Use as `migrateLegacyChurnSnapshotKeys(JSON.parse(snapshot))`.
 */
export function migrateLegacyChurnSnapshotKeys<T>(parsed: T): T {
  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }
  const obj = parsed as Record<string, unknown>;
  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_CHURN_SNAPSHOT_KEY_MAP)) {
    if (legacyKey in obj) {
      if (!(canonicalKey in obj) && obj[legacyKey] !== undefined) {
        obj[canonicalKey] = obj[legacyKey];
      }
      delete obj[legacyKey];
    }
  }
  return parsed;
}
