// @ts-nocheck
import path from "path";

/**
 * True when running as a Bun-compiled standalone executable.
 */
function isCompiledBinary() {
    return import.meta.path === process.execPath;
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
