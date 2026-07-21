/**
 * Downloads platform-specific @lydell/node-pty-* binaries for ALL target
 * architectures so the packaged Electron app works on any CPU/OS.
 *
 * pnpm (by design) only installs optionalDependencies matching the current
 * machine's `process.arch` + `process.platform`.  When building universal or
 * cross-platform packages we need every variant present in node_modules so
 * electron-builder can include them.
 *
 * This script fetches the npm tarball for each missing platform package and
 * places it in the .pnpm virtual store in the same layout pnpm would use.
 */

import { execSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(__dirname, "..");
const repoRoot = resolve(desktopRoot, "../..");

// The root-level .pnpm virtual store where pnpm keeps all packages.
const PNPM_STORE = resolve(repoRoot, "node_modules", ".pnpm");
const VERSION = "1.2.0-beta.12";

/**
 * All platform-specific optional deps of @lydell/node-pty that we need
 * to bundle so the packaged app works everywhere.
 */
const PLATFORM_PACKAGES = [
  {
    name: "@lydell/node-pty-darwin-arm64",
    storeDir: `@lydell+node-pty-darwin-arm64@${VERSION}`,
  },
  {
    name: "@lydell/node-pty-darwin-x64",
    storeDir: `@lydell+node-pty-darwin-x64@${VERSION}`,
  },
  {
    name: "@lydell/node-pty-linux-arm64",
    storeDir: `@lydell+node-pty-linux-arm64@${VERSION}`,
  },
  {
    name: "@lydell/node-pty-linux-x64",
    storeDir: `@lydell+node-pty-linux-x64@${VERSION}`,
  },
  {
    name: "@lydell/node-pty-win32-arm64",
    storeDir: `@lydell+node-pty-win32-arm64@${VERSION}`,
  },
  {
    name: "@lydell/node-pty-win32-x64",
    storeDir: `@lydell+node-pty-win32-x64@${VERSION}`,
  },
];

/**
 * Download an npm tarball and extract it into the given directory.
 */
async function fetchAndExtract(packageName, targetDir) {
  const url = `https://registry.npmjs.org/${packageName}/-/${packageName.split("/").pop()}-${VERSION}.tgz`;
  const tmp = join(
    tmpdir(),
    `node-pty-${packageName.split("/").pop()}-${Date.now()}`,
  );

  console.log(`  ↓ ${packageName}@${VERSION}`);

  try {
    // Download tarball
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    const buffer = await response.arrayBuffer();

    // Write to temp file
    mkdirSync(tmp, { recursive: true });
    const tarballPath = join(tmp, "package.tgz");
    writeFileSync(tarballPath, Buffer.from(buffer));

    // Extract
    const result = spawnSync("tar", ["-xzf", tarballPath, "-C", tmp], {
      stdio: "pipe",
    });
    if (result.status !== 0) {
      throw new Error(`tar extraction failed: ${result.stderr?.toString()}`);
    }

    // Move from package/ to target
    const extracted = join(tmp, "package");
    if (!existsSync(extracted)) {
      throw new Error(`Expected extracted dir at ${extracted}`);
    }

    // Ensure target parent exists
    mkdirSync(dirname(targetDir), { recursive: true });

    // Remove existing target if present
    if (existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    }

    // Move extracted content to target
    execSync(`mv "${extracted}" "${targetDir}"`, { stdio: "pipe" });

    console.log(`    → ${targetDir}`);
    return true;
  } catch (err) {
    console.error(
      `  ✗ Failed to download/extract ${packageName}: ${err.message}`,
    );
    return false;
  } finally {
    if (existsSync(tmp)) {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
}

async function main() {
  console.log("Preparing cross-platform @lydell/node-pty binaries…\n");

  // The main node-pty package's @lydell scope where pnpm places symlinks
  // to sibling platform packages.  `node-pty/index.js` resolves
  // `require('@lydell/node-pty-darwin-x64')` from this directory.
  const mainScopeDir = join(
    PNPM_STORE,
    `@lydell+node-pty@${VERSION}`,
    "node_modules",
    "@lydell",
  );

  if (!existsSync(mainScopeDir)) {
    console.error(
      `FATAL: Expected main node-pty scope at ${mainScopeDir} – has pnpm install run?`,
    );
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (const pkg of PLATFORM_PACKAGES) {
    const storePkgDir = join(
      PNPM_STORE,
      pkg.storeDir,
      "node_modules",
      pkg.name,
    );
    const symlinkTarget = join(mainScopeDir, pkg.name.split("/").pop());

    // Check if already present
    if (existsSync(storePkgDir) && existsSync(symlinkTarget)) {
      console.log(`  ✓ ${pkg.name} already installed`);
      ok++;
      continue;
    }

    // Download and extract into the .pnpm store
    const fetched = await fetchAndExtract(pkg.name, storePkgDir);
    if (!fetched) {
      fail++;
      continue;
    }

    // Create symlink from the main node-pty's @lydell scope
    const linkName = pkg.name.split("/").pop();
    const linkPath = join(mainScopeDir, linkName);
    const relativeTarget = join(
      "..",
      "..",
      "..",
      pkg.storeDir,
      "node_modules",
      pkg.name,
    );

    if (existsSync(linkPath)) {
      rmSync(linkPath, { recursive: true, force: true });
    }
    symlinkSync(relativeTarget, linkPath);
    console.log(`    → symlink ${linkName}`);
    ok++;
  }

  console.log(`\nDone: ${ok} installed, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
