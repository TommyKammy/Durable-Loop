/**
 * Phase 4: Shared executor runner utilities.
 *
 * Provides the generic turn-result type, session-id extraction, and a
 * factory for creating AgentRunner instances from provider-specific
 * turn functions. This mirrors the createCodexAgentRunner pattern but
 * is provider-neutral.
 */

import { runCommand } from "../core/command";
import { truncatePreservingStartAndEnd } from "../core/utils";
import type {
  FailureContext,
  FailureKind,
  IssueRunRecord,
  RunState,
  SupervisorConfig,
} from "../core/types";
import type { PromptBuilder } from "./types";
import { parseAgentTurnStructuredResult } from "../supervisor/agent-runner";
import { buildCodexFailureContext, classifyFailure, classifyTurnError } from "../supervisor/supervisor-failure-helpers";
import type {
  AgentRunner,
  AgentRunnerCapabilities,
  AgentTurnContext,
  AgentTurnResult,
} from "../supervisor/agent-runner";

/**
 * Result of a provider-specific turn execution.
 * Same shape as CodexTurnResult — normalized across all providers.
 */
export interface ExecutorTurnResult {
  exitCode: number;
  sessionId: string | null;
  lastMessage: string;
  stderr: string;
  stdout: string;
}

/**
 * Function signature for a provider-specific turn execution.
 * Analogous to `runCodexTurn`.
 */
export type RunExecutorTurnFn = (
  config: SupervisorConfig,
  workspacePath: string,
  prompt: string,
  state: RunState,
  record?: Pick<
    IssueRunRecord,
    | "repeated_failure_signature_count"
    | "blocked_verification_retry_count"
    | "timeout_retry_count"
  > | null,
  sessionId?: string | null,
) => Promise<ExecutorTurnResult>;

/**
 * Generic session-id extraction from JSON-lines output.
 *
 * Scans stdout line-by-line for JSON objects containing a session/thread ID.
 * Supports common field names across providers:
 * - `session_id`, `sessionId`, `thread_id`, `threadId`
 * - Prefers events with type containing "session" or "thread"
 * - Falls back to any JSON object containing one of the ID fields
 */
export function extractSessionIdFromJsonOutput(
  stdout: string,
  fallback?: string | null,
): string | null {
  let resolved: string | null = fallback ?? null;

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }

    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      const type = typeof event.type === "string" ? event.type : "";
      const idFields = ["session_id", "sessionId", "thread_id", "threadId", "id"];

      // Prefer session/thread events
      if (type.includes("session") || type.includes("thread")) {
        for (const field of idFields) {
          const value = event[field];
          if (typeof value === "string" && value.length > 0) {
            resolved = value;
            break;
          }
        }
      }

      // Fallback: any object with a session ID field
      if (!resolved) {
        for (const field of idFields) {
          const value = event[field];
          if (typeof value === "string" && value.length > 0) {
            // Only use if it looks like a session ID (UUID-like or long alphanumeric)
            if (value.length >= 8) {
              resolved = value;
              break;
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  return resolved;
}

/**
 * Extract the last assistant message from JSON-lines output.
 *
 * Scans JSON lines for assistant message events and returns the text
 * content of the last one. Supports common shapes:
 * - `{ type: "assistant", content: "..." }`
 * - `{ type: "assistant", message: { content: "..." } }`
 * - `{ role: "assistant", content: "..." }`
 * - `{ type: "result", result: "..." }` (Claude Code JSON output)
 * - `{ type: "message", role: "assistant", content: [...] }` (Claude Code stream)
 */
export function extractLastAssistantMessage(stdout: string): string {
  let lastMessage = "";

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }

    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      const type = typeof event.type === "string" ? event.type : "";
      const role = typeof event.role === "string" ? event.role : "";

      // OpenCode: { type: "assistant", content: "..." }
      // Claude Code: { type: "assistant", message: { content: [...] } }
      // Claude Code: { type: "result", result: "..." }
      const isAssistant =
        type === "assistant" ||
        role === "assistant" ||
        type === "result" ||
        type === "message";

      if (!isAssistant) {
        continue;
      }

      const text = extractTextFromEvent(event);
      if (text) {
        lastMessage = text;
      }
    } catch {
      continue;
    }
  }

  return lastMessage;
}

/**
 * Extract text content from a JSON event object.
 * Handles various content formats across providers.
 */
function extractTextFromEvent(event: Record<string, unknown>): string {
  // Direct content string
  if (typeof event.content === "string") {
    return event.content;
  }

  // Claude Code result field
  if (typeof event.result === "string") {
    return event.result;
  }

  // Claude Code: message.content is an array of content blocks
  const message = event.message;
  if (typeof message === "object" && message !== null) {
    const msg = message as Record<string, unknown>;
    if (typeof msg.content === "string") {
      return msg.content;
    }
    if (Array.isArray(msg.content)) {
      const texts: string[] = [];
      for (const block of msg.content) {
        if (typeof block === "object" && block !== null) {
          const b = block as Record<string, unknown>;
          if (typeof b.text === "string") {
            texts.push(b.text);
          }
          if (typeof b.content === "string") {
            texts.push(b.content);
          }
        }
      }
      if (texts.length > 0) {
        return texts.join("\n");
      }
    }
  }

  // OpenCode: content is an array of content blocks
  if (Array.isArray(event.content)) {
    const texts: string[] = [];
    for (const block of event.content) {
      if (typeof block === "object" && block !== null) {
        const b = block as Record<string, unknown>;
        if (typeof b.text === "string") {
          texts.push(b.text);
        }
        if (typeof b.content === "string") {
          texts.push(b.content);
        }
      } else if (typeof block === "string") {
        texts.push(block);
      }
    }
    if (texts.length > 0) {
      return texts.join("\n");
    }
  }

  return "";
}

/**
 * Options for creating a generic executor agent runner.
 */
export interface CreateExecutorRunnerOptions {
  config?: SupervisorConfig;
  runTurnImpl: RunExecutorTurnFn;
  classifyFailureImpl?: typeof classifyFailure;
  buildFailureContextImpl?: typeof buildCodexFailureContext;
  capabilities: AgentRunnerCapabilities;
  /** Failure kind for non-zero exit codes (default: "command_error"). */
  exitFailureKind?: Exclude<FailureKind, null>;
  /** Category for failure context (default: "codex" for backward compat). */
  failureCategory?: FailureContext["category"];
  /** Provider name for failure context summary. */
  providerName: string;
  /**
   * Prompt builder for constructing the supervisor prompt.
   *
   * Required: this provider-neutral runner has no safe default, so every
   * executor must pass its own builder (e.g. a GenericPromptBuilder for a
   * non-Codex provider). Defaulting here would silently emit Codex-branded
   * prompts for a provider that forgot to supply one.
   */
  promptBuilder: PromptBuilder;
}

/**
 * Generic factory that creates an AgentRunner from a provider-specific
 * turn function. Mirrors the createCodexAgentRunner pattern but is
 * provider-neutral.
 *
 * The runner:
 * 1. Builds the prompt via the PromptBuilder (same labeled output format)
 * 2. Calls the provider-specific turn function
 * 3. Parses structured result on success
 * 4. Classifies and builds failure context on error
 */
export function createExecutorAgentRunner(
  options: CreateExecutorRunnerOptions,
): AgentRunner {
  const runTurnImpl = options.runTurnImpl;
  const classifyFailureImpl = options.classifyFailureImpl ?? classifyFailure;
  const buildFailureContextImpl = options.buildFailureContextImpl ?? buildCodexFailureContext;
  const exitFailureKind = options.exitFailureKind ?? "command_error";
  const failureCategory = options.failureCategory ?? "executor";
  const providerName = options.providerName;
  const promptBuilder = options.promptBuilder;

  return {
    capabilities: options.capabilities,
    async runTurn(context: AgentTurnContext): Promise<AgentTurnResult> {
      try {
        const prompt = promptBuilder.buildPrompt(context);
        const result = await runTurnImpl(
          context.config,
          context.workspacePath,
          prompt,
          context.state,
          context.record,
          context.kind === "resume" ? context.sessionId : undefined,
        );

        const failureKind: FailureKind =
          result.exitCode === 0 ? null : exitFailureKind;
        const structuredResult =
          failureKind === null
            ? parseAgentTurnStructuredResult(result.lastMessage)
            : null;

        return {
          exitCode: result.exitCode,
          sessionId: result.sessionId,
          supervisorMessage: result.lastMessage,
          stderr: result.stderr,
          stdout: result.stdout,
          structuredResult,
          failureKind,
          failureContext:
            failureKind === null
              ? null
              : buildFailureContextImpl(
                  failureCategory,
                  `${providerName} exited non-zero.`,
                  [
                    truncatePreservingStartAndEnd(
                      [result.lastMessage, result.stderr, result.stdout]
                        .filter(Boolean)
                        .join("\n"),
                      2000,
                    ) ?? "Unknown failure output",
                  ],
                ),
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.stack ?? error.message : String(error);
        return {
          exitCode: 1,
          sessionId: context.kind === "resume" ? context.sessionId : null,
          supervisorMessage: "",
          stderr: message,
          stdout: "",
          structuredResult: null,
          failureKind: classifyTurnError(error, message, classifyFailureImpl),
          failureContext: buildFailureContextImpl(
            failureCategory,
            `${providerName} turn execution failed.`,
            [
              truncatePreservingStartAndEnd(message, 2000) ?? "Unknown failure",
            ],
          ),
        };
      }
    },
  };
}

/**
 * Run a CLI command and return an ExecutorTurnResult.
 *
 * Shared utility for provider-specific turn functions. Handles:
 * - Spawning the CLI process
 * - Extracting session ID from JSON output
 * - Extracting the last assistant message from JSON output
 * - Normalizing the result into ExecutorTurnResult
 */
/**
 * Generous cap for executor JSON output. Large enough not to truncate normal
 * turns, but bounded so a runaway CLI cannot exhaust memory. Capture preserves
 * the start (session events) and end (result / last assistant message), and the
 * per-line JSON parsers skip the truncation-marker line, so a turn still yields
 * a usable session id and last message even if its output is truncated.
 */
export const EXECUTOR_STDOUT_CAPTURE_LIMIT = 16 * 1024 * 1024;

export async function runExecutorCliCommand(
  binary: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs: number;
    sessionId?: string | null;
    /** If true, extract lastMessage from JSON stdout. If false, use stdout directly. */
    parseJsonOutput?: boolean;
    /** Bounded stdout capture limit (chars). Defaults to EXECUTOR_STDOUT_CAPTURE_LIMIT. */
    stdoutCaptureLimitBytes?: number;
  },
): Promise<ExecutorTurnResult> {
  const result = await runCommand(binary, args, {
    cwd: options.cwd,
    allowExitCodes: [0, 1],
    env: options.env,
    timeoutMs: options.timeoutMs,
    // Bounded (not null) so huge/runaway output cannot exhaust memory; the cap
    // is generous and capture preserves both ends for the JSON line parsers.
    stdoutCaptureLimitBytes: options.stdoutCaptureLimitBytes ?? EXECUTOR_STDOUT_CAPTURE_LIMIT,
  });

  const parseJson = options.parseJsonOutput ?? true;
  const lastMessage = parseJson
    ? extractLastAssistantMessage(result.stdout)
    : result.stdout.trim();

  const sessionId = parseJson
    ? extractSessionIdFromJsonOutput(result.stdout, options.sessionId)
    : options.sessionId ?? null;

  return {
    exitCode: result.exitCode,
    sessionId,
    lastMessage,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}
