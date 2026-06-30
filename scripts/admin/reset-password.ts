import Database from "@/server/database";
import { R } from "@/server/bun-sqlite-store";
import readline from "readline";
import { passwordStrength } from "@/util/password-strength";
import { initJWTSecret } from "@/server/util-server";
import User from "@/server/model/user";
import { args } from "@/server/args";

console.log("== Uptime Kuma Reset Password Tool ==");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const main = async () => {
    if ("dry-run" in args) {
        console.log("Dry run mode, no changes will be made.");
    }

    console.log("Connecting the database");

    try {
        Database.initDataDir(args);
        await Database.connect(false, true);
        // No need to actually reset the password for testing, just make sure no connection problem. It is ok for now.
        if (!process.env.TEST_BACKEND) {
            const user = await R.findOne("user");
            if (!user) {
                throw new Error("user not found, have you installed?");
            }

            console.log("Found user: " + user.username);

            while (true) {
                let password;
                let confirmPassword;

                // When called with "--new-password" argument for unattended modification.
                if ("new-password" in args) {
                    console.log("Using password from argument");
                    console.warn(
                        "\x1b[31m%s\x1b[0m",
                        "Warning: the password might be stored, in plain text, in your shell's history"
                    );
                    password = confirmPassword = args["new-password"] + "";
                    if (passwordStrength(password).value === "Too weak") {
                        throw new Error("Password is too weak, please use a stronger password.");
                    }
                } else {
                    password = await question("New Password: ");
                    if (passwordStrength(password).value === "Too weak") {
                        console.log("Password is too weak, please try again.");
                        continue;
                    }
                    confirmPassword = await question("Confirm New Password: ");
                }

                if (password === confirmPassword) {
                    if (!("dry-run" in args)) {
                        await User.resetPassword(user.id, password);

                        // Reset all sessions by reset jwt secret
                        await initJWTSecret();

                        console.warn(
                            "JWT secret was reset. Restart the server to disconnect active WebSocket sessions."
                        );
                    }
                    break;
                } else {
                    console.log("Passwords do not match, please try again.");
                }
            }
            console.log("Password reset successfully.");
        }
    } catch (e) {
        console.error("Error: " + e.message);
    }

    await Database.close();
    rl.close();

    console.log("Finished.");
};

/**
 * Ask question of user
 * @param {string} question Question to ask
 * @returns {Promise<string>} Users response
 */
function question(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

if (!process.env.TEST_BACKEND) {
    main();
}

export { main };
