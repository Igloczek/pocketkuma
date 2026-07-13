// @ts-nocheck

import { BeanModel } from "@/server/bean-model";
import passwordHash from "@/server/password-hash";
import { R } from "@/server/bun-sqlite-store";
import jwt from "@/server/jwt";
import { shake256, SHAKE256_LENGTH } from "@/server/util-server";

class User extends BeanModel {
    /**
     * Reset user password
     * Fix #1510, as in the context reset-password.ts, there is no auto model mapping. Call this static function instead.
     * @param {number} userID ID of user to update
     * @param {string} newPassword Users new password
     * @returns {Promise<void>}
     */
    static async resetPassword(userID, newPassword) {
        await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
            await passwordHash.generate(newPassword),
            userID,
        ]);
    }

    /**
     * Reset this users password
     * @param {string} newPassword Users new password
     * @returns {Promise<void>}
     */
    async resetPassword(newPassword) {
        const hashedPassword = await passwordHash.generate(newPassword);

        await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [hashedPassword, this.id]);

        this.password = hashedPassword;
    }

    /**
     * Create a new JWT for a user
     * @param {User} user The User to create a JsonWebToken for
     * @param {string} jwtSecret The key used to sign the JsonWebToken
     * @param {string} sessionID Persistent session identifier
     * @returns {string} the JsonWebToken as a string
     */
    static createJWT(user, jwtSecret, sessionID) {
        return jwt.sign(
            {
                username: user.username,
                h: shake256(user.password, SHAKE256_LENGTH),
                sid: sessionID,
            },
            jwtSecret
        );
    }

    /**
     * Create a persistent session and its JWT.
     * @param {User} user Authenticated user
     * @param {string} jwtSecret JWT signing secret
     * @returns {Promise<{id: string, token: string}>} Session ID and signed token
     */
    static async createSession(user, jwtSecret) {
        const id = crypto.randomUUID();
        await R.exec("INSERT INTO setting (`key`, `value`) VALUES (?, ?)", [`session:${id}`, String(user.id)]);
        return { id, token: User.createJWT(user, jwtSecret, id) };
    }

    /**
     * Check that a JWT session is still active for the user.
     * @param {string} sessionID Session identifier
     * @param {number} userID User identifier
     * @returns {Promise<boolean>} Whether the session is active
     */
    static async hasSession(sessionID, userID) {
        if (typeof sessionID !== "string") {
            return false;
        }
        return (
            (await R.getCell("SELECT 1 FROM setting WHERE `key` = ? AND `value` = ?", [
                `session:${sessionID}`,
                String(userID),
            ])) === 1
        );
    }

    /**
     * Revoke one persistent session.
     * @param {string} sessionID Session identifier
     * @param {number} userID User identifier
     * @returns {Promise<void>}
     */
    static async revokeSession(sessionID, userID) {
        if (typeof sessionID === "string") {
            await R.exec("DELETE FROM setting WHERE `key` = ? AND `value` = ?", [
                `session:${sessionID}`,
                String(userID),
            ]);
        }
    }

    /**
     * Revoke every persistent session for a user.
     * @param {number} userID User identifier
     * @returns {Promise<void>}
     */
    static async revokeAllSessions(userID) {
        await R.exec("DELETE FROM setting WHERE `key` LIKE 'session:%' AND `value` = ?", [String(userID)]);
    }
}

export default User;
