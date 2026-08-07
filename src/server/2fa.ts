// @ts-nocheck

class TwoFA {
    /**
     * Disable 2FA for specified user
     * @param {number} userID ID of user to disable
     * @returns {Promise<void>}
     */
    static async disable2FA(store, userID) {
        return await store.exec(
            "UPDATE `user` SET twofa_status = 0, twofa_secret = NULL, twofa_last_token = NULL WHERE id = ? ",
            [userID]
        );
    }
}

export default TwoFA;
