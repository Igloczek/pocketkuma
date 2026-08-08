// @ts-nocheck

import { checkLogin } from "@/server/socket-auth";
import { log } from "@/server/logger";

export const chartSocketHandler = (socket, store, heartbeatData) => {
    socket.on("getMonitorChartData", async (monitorID, period, callback) => {
        try {
            checkLogin(socket);

            log.debug("monitor", `Get Monitor Chart Data: ${monitorID} User ID: ${socket.userID}`);

            if (period === null || period === undefined) {
                throw new Error("Invalid period.");
            }

            const owned = await store.getCell("SELECT 1 FROM monitor WHERE id = ? AND user_id = ?", [
                monitorID,
                socket.userID,
            ]);
            if (!owned) {
                throw new Error("You do not own this monitor.");
            }

            let uptimeCalculator = await heartbeatData.uptime.get(monitorID);

            let data;
            if (period <= 24) {
                data = uptimeCalculator.getDataArray(period * 60, "minute");
            } else if (period <= 720) {
                data = uptimeCalculator.getDataArray(period, "hour");
            } else {
                data = uptimeCalculator.getDataArray(period / 24, "day");
            }

            callback({
                ok: true,
                data,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
