import Database from "../../src/server/database.ts";
import { R } from "redbean-node";
import readline from "readline";
import TwoFA from "../../src/server/2fa.ts";
import { args } from "../../src/server/args.ts";

console.log("== Uptime Kuma Remove 2FA Tool ==");
console.log("Loading the database");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const main = async () => {
    Database.initDataDir(args);
    await Database.connect();

    try {
        // No need to actually reset the password for testing, just make sure no connection problem. It is ok for now.
        if (!process.env.TEST_BACKEND) {
            const user = await R.findOne("user");
            if (!user) {
                throw new Error("user not found, have you installed?");
            }

            console.log("Found user: " + user.username);

            let ans = await question("Are you sure want to remove 2FA? [y/N]");

            if (ans.toLowerCase() === "y") {
                await TwoFA.disable2FA(user.id);
                console.log("2FA has been removed successfully.");
            }
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
