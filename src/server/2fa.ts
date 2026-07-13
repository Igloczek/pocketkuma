// @ts-nocheck

import { R } from "@/server/bun-sqlite-store";

class TwoFA {
    /**
     * Disable 2FA for specified user
     * @param {number} userID ID of user to disable
     * @returns {Promise<void>}
     */
    static async disable2FA(userID) {
        return await R.exec(
            "UPDATE `user` SET twofa_status = 0, twofa_secret = NULL, twofa_last_token = NULL WHERE id = ? ",
            [userID]
        );
    }
}

export default TwoFA;
