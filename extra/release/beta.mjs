import {
    buildDist,
    buildImage,
    checkDocker,
    checkTagExists,
    checkVersionFormat,
    getRepoNames,
    checkReleaseBranch,
    createDistTarGz,
    createReleasePR,
} from "./lib.mjs";
import semver from "semver";

const repoNames = getRepoNames();
const version = process.env.RELEASE_BETA_VERSION;
const dryRun = process.env.DRY_RUN === "true";
const previousVersion = process.env.RELEASE_PREVIOUS_VERSION;
const branchName = `release-${version}`;
const githubRunId = process.env.GITHUB_RUN_ID;

if (dryRun) {
    console.log("Dry run mode enabled. No images will be pushed.");
}

console.log("RELEASE_BETA_VERSION:", version);

// Check if the current branch is "release-{version}"
checkReleaseBranch(branchName);

// Check if the version is a valid semver
checkVersionFormat(version);

// Check if the semver identifier is "beta"
const semverIdentifier = semver.prerelease(version);
console.log("Semver identifier:", semverIdentifier);
if (semverIdentifier[0] !== "beta") {
    console.error("VERSION should have a semver identifier of 'beta'");
    process.exit(1);
}

// Check if docker is running
checkDocker();

// Check if the tag exists
await checkTagExists(repoNames, version);

// bun extra/beta/update-version.mjs
await import("../beta/update-version.mjs");

// Create Pull Request (gh pr create will handle pushing the branch)
await createReleasePR(version, previousVersion, dryRun, branchName, githubRunId);

// Build frontend dist
buildDist();

if (!dryRun) {
    buildImage(repoNames, ["beta", version], "release");
} else {
    console.log("Dry run mode - skipping image build and push.");
}

// Create dist.tar.gz
await createDistTarGz();
