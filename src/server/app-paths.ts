// @ts-nocheck
import path from "path";

/**
 * True when running as a Bun-compiled standalone executable.
 *
 * Bun virtualizes the entrypoint under `/$bunfs/root/...` while `process.execPath`
 * remains the real binary path on disk, so a direct path equality check is wrong.
 */
function isCompiledBinary() {
    const metaPath = String(import.meta.path || "");
    if (metaPath.includes("$bunfs")) {
        return true;
    }

    // Fallback for older Bun versions that exposed the real binary path.
    return metaPath === process.execPath;
}

/**
 * Directory containing the executable (compiled) or project cwd (source).
 */
function getInstallDir() {
    if (isCompiledBinary()) {
        return path.dirname(process.execPath);
    }

    return process.cwd();
}

/**
 * Default application data directory — `./data` next to the executable.
 */
function defaultDataDir() {
    return path.join(getInstallDir(), "data");
}

/**
 * Resolve a path relative to the install directory.
 */
function resolveFromInstall(...segments) {
    return path.join(getInstallDir(), ...segments);
}

export { isCompiledBinary, getInstallDir, defaultDataDir, resolveFromInstall };
