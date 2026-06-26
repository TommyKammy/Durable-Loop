/**
 * Phase 6: Re-export from provider-neutral location.
 *
 * The output parser functions were moved to src/core/turn-output-parser.ts
 * because they parse the labeled footer format which is identical across
 * all providers. This file re-exports for backward compatibility.
 */

export { extractStateHint, extractBlockedReason, extractFailureSignature } from "../core/turn-output-parser";
