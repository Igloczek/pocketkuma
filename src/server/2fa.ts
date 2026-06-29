// @ts-nocheck

import { R } from "./redbean-compat.ts";

class TwoFA {
    /**
     * Disable 2FA for specified user
     * @param {number} userID ID of user to disable
     * @returns {Promise<void>}
     */
    static async disable2FA(userID) {
        return await R.exec("UPDATE `user` SET twofa_status = 0 WHERE id = ? ", [userID]);
    }
}

export default TwoFA;
