/**
 * Repo-owned subprocess safety gate.
 *
 * Scans the verifier scripts under scripts/ and the repo-owned subprocess test
 * surfaces for unsafe child-process usage: missing bounded timeouts, unresolved
 * executables relying on PATH lookup, and shell trampolines. Fails the process
 * when any finding is reported. Wired into `npm run verify:subprocess-safety`.
 *
 * Implemented as an in-process call to findSubprocessSafetyFindings so it spawns
 * no child processes and is itself compliant with the contract it enforces.
 */

import { findSubprocessSafetyFindings } from "../src/subprocess-safety";

async function main(): Promise<void> {
  const workspacePath = process.cwd();
  const findings = await findSubprocessSafetyFindings({ workspacePath });

  if (findings.length === 0) {
    console.log("subprocess safety gate: no findings.");
    return;
  }

  console.error(
    `subprocess safety gate: ${findings.length} finding(s) detected:`,
  );
  for (const finding of findings) {
    console.error(
      `- ${finding.filePath}:${finding.line} [${finding.ruleId}] ${finding.summary}`,
    );
  }
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
