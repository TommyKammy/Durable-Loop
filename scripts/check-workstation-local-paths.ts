/**
 * Workstation-local path hygiene gate.
 *
 * Scans every git-tracked file for forbidden workstation-local absolute paths
 * (developer home directories, supervisor-owned runtime artifacts, etc.) and
 * fails the process when any are found. Wired into `npm run verify:paths` and
 * the CI workflow's Ubuntu path-hygiene step.
 *
 * Implemented as an in-process call to findForbiddenWorkstationLocalPaths so it
 * spawns no child processes and stays compliant with the repo-owned subprocess
 * safety contract (see scripts/check-subprocess-safety.ts).
 */

import {
  findForbiddenWorkstationLocalPaths,
  formatWorkstationLocalPathMatch,
} from "../src/workstation-local-paths";

async function main(): Promise<void> {
  const workspacePath = process.cwd();
  const findings = await findForbiddenWorkstationLocalPaths(workspacePath);

  if (findings.length === 0) {
    console.log("workstation-local path hygiene gate: no findings.");
    return;
  }

  console.error(
    `workstation-local path hygiene gate: ${findings.length} finding(s) detected:`,
  );
  for (const finding of findings) {
    console.error(formatWorkstationLocalPathMatch(finding));
  }
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
