import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { updateSetupConfig, type SetupConfigChanges } from "./setup-config-write";

test("updateSetupConfig accepts the legacy codexBinary input and canonicalizes it to executorBinary", async () => {
  // A setup client that has not migrated still sends { codexBinary }. The
  // unknown-field guard must not reject it; it is canonicalized to executorBinary
  // and the legacy key is never written back.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-write-legacy-"));
  const configPath = path.join(dir, "supervisor.config.json");
  await fs.writeFile(configPath, JSON.stringify({ executorBinary: "old-binary" }), "utf8");

  const result = await updateSetupConfig({
    configPath,
    changes: { codexBinary: "/usr/bin/opencode" } as unknown as SetupConfigChanges,
  });

  assert.equal(result.document.executorBinary, "/usr/bin/opencode");
  assert.equal("codexBinary" in result.document, false);

  const written = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  assert.equal(written.executorBinary, "/usr/bin/opencode");
  assert.equal("codexBinary" in written, false);
});

test("updateSetupConfig migrates a legacy codexBinary even when an unrelated field is saved", async () => {
  // Existing config only has the legacy key; the operator saves an unrelated
  // field. The write must still canonicalize to executorBinary and drop the
  // stale legacy key rather than copying it back untouched.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-write-migrate-"));
  const configPath = path.join(dir, "supervisor.config.json");
  await fs.writeFile(
    configPath,
    JSON.stringify({ codexBinary: "/usr/bin/codex", repoPath: "/old/repo" }),
    "utf8",
  );

  const result = await updateSetupConfig({
    configPath,
    changes: { repoPath: "/new/repo" } as unknown as SetupConfigChanges,
  });

  assert.equal(result.document.executorBinary, "/usr/bin/codex");
  assert.equal(result.document.repoPath, "/new/repo");
  assert.equal("codexBinary" in result.document, false);

  const written = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
  assert.equal(written.executorBinary, "/usr/bin/codex");
  assert.equal("codexBinary" in written, false);
});
