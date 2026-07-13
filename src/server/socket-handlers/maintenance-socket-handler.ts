// @ts-nocheck

import { checkLogin } from "@/server/util-server";
import { log } from "@/util";
import { R } from "@/server/bun-sqlite-store";
import { clearResponseCache } from "@/server/bun-response";
import { PocketKumaServer } from "@/server/pocketkuma-server";
import Maintenance from "@/server/model/maintenance";

const server = PocketKumaServer.getInstance();

function getOwnedMaintenance(maintenanceID, userID) {
    const maintenance = server.getMaintenance(maintenanceID);
    if (!maintenance || maintenance.user_id !== userID) {
        throw new Error("Maintenance not found");
    }
    return maintenance;
}

async function getUniqueRelationIDs(items, table, userID = null) {
    if (!Array.isArray(items)) {
        throw new Error("Invalid relation list");
    }
    const ids = [...new Set(items.map((item) => item?.id))];
    for (const id of ids) {
        if (!Number.isInteger(id)) {
            throw new Error("Invalid relation id");
        }
        const condition = userID === null ? " id = ? " : " id = ? AND user_id = ? ";
        const params = userID === null ? [id] : [id, userID];
        if (!(await R.findOne(table, condition, params))) {
            throw new Error("Relation not found");
        }
    }
    return ids;
}

/**
 * Handlers for Maintenance
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
export const maintenanceSocketHandler = (socket) => {
    // Add a new maintenance
    socket.on("addMaintenance", async (maintenance, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", maintenance);

            let bean = await Maintenance.jsonToBean(R.dispense("maintenance"), maintenance);
            bean.user_id = socket.userID;
            let maintenanceID = await R.store(bean);

            server.maintenanceList[maintenanceID] = bean;
            await bean.run(true);

            await server.sendMaintenanceList(socket);

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
                maintenanceID,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Edit a maintenance
    socket.on("editMaintenance", async (maintenance, callback) => {
        try {
            checkLogin(socket);

            let bean = getOwnedMaintenance(maintenance?.id, socket.userID);

            await Maintenance.jsonToBean(bean, maintenance);
            await R.store(bean);
            await bean.run(true);
            await server.sendMaintenanceList(socket);

            callback({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                maintenanceID: bean.id,
            });
        } catch (e) {
            log.error("maintenance", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Add a new monitor_maintenance
    socket.on("addMonitorMaintenance", async (maintenanceID, monitors, callback) => {
        try {
            checkLogin(socket);

            getOwnedMaintenance(maintenanceID, socket.userID);
            const monitorIDs = await getUniqueRelationIDs(monitors, "monitor", socket.userID);

            await R.exec("DELETE FROM monitor_maintenance WHERE maintenance_id = ?", [maintenanceID]);
            for (const monitorID of monitorIDs) {
                let bean = R.dispense("monitor_maintenance");

                bean.import({
                    monitor_id: monitorID,
                    maintenance_id: maintenanceID,
                });
                await R.store(bean);
            }

            clearResponseCache();

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Add a new monitor_maintenance
    socket.on("addMaintenanceStatusPage", async (maintenanceID, statusPages, callback) => {
        try {
            checkLogin(socket);

            getOwnedMaintenance(maintenanceID, socket.userID);
            const statusPageIDs = await getUniqueRelationIDs(statusPages, "status_page");

            await R.exec("DELETE FROM maintenance_status_page WHERE maintenance_id = ?", [maintenanceID]);
            for (const statusPageID of statusPageIDs) {
                let bean = R.dispense("maintenance_status_page");

                bean.import({
                    status_page_id: statusPageID,
                    maintenance_id: maintenanceID,
                });
                await R.store(bean);
            }

            clearResponseCache();

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getMaintenance", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", `Get Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let bean = getOwnedMaintenance(maintenanceID, socket.userID);

            callback({
                ok: true,
                maintenance: await bean.toJSON(),
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getMaintenanceList", async (callback) => {
        try {
            checkLogin(socket);

            await server.sendMaintenanceList(socket);
            callback({
                ok: true,
            });
        } catch (e) {
            log.error("maintenance", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getMonitorMaintenance", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            getOwnedMaintenance(maintenanceID, socket.userID);

            log.debug("maintenance", `Get Monitors for Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let monitors = await R.getAll(
                "SELECT monitor.id FROM monitor_maintenance mm JOIN monitor ON mm.monitor_id = monitor.id WHERE mm.maintenance_id = ? ",
                [maintenanceID]
            );

            callback({
                ok: true,
                monitors,
            });
        } catch (e) {
            log.error("maintenance", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getMaintenanceStatusPage", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            getOwnedMaintenance(maintenanceID, socket.userID);

            log.debug("maintenance", `Get Status Pages for Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let statusPages = await R.getAll(
                "SELECT status_page.id, status_page.title FROM maintenance_status_page msp JOIN status_page ON msp.status_page_id = status_page.id WHERE msp.maintenance_id = ? ",
                [maintenanceID]
            );

            callback({
                ok: true,
                statusPages,
            });
        } catch (e) {
            log.error("maintenance", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteMaintenance", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", `Delete Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            const maintenance = getOwnedMaintenance(maintenanceID, socket.userID);
            maintenance.stop();
            delete server.maintenanceList[maintenanceID];

            await R.exec("DELETE FROM maintenance WHERE id = ? AND user_id = ? ", [maintenanceID, socket.userID]);

            clearResponseCache();

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
            });

            await server.sendMaintenanceList(socket);
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("pauseMaintenance", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", `Pause Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let maintenance = getOwnedMaintenance(maintenanceID, socket.userID);

            maintenance.active = false;
            await R.store(maintenance);
            maintenance.stop();

            clearResponseCache();

            callback({
                ok: true,
                msg: "successPaused",
                msgi18n: true,
            });

            await server.sendMaintenanceList(socket);
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("resumeMaintenance", async (maintenanceID, callback) => {
        try {
            checkLogin(socket);

            log.debug("maintenance", `Resume Maintenance: ${maintenanceID} User ID: ${socket.userID}`);

            let maintenance = getOwnedMaintenance(maintenanceID, socket.userID);

            maintenance.active = true;
            await R.store(maintenance);
            await maintenance.run();

            clearResponseCache();

            callback({
                ok: true,
                msg: "successResumed",
                msgi18n: true,
            });

            await server.sendMaintenanceList(socket);
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
