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

async function writeRelations(store, maintenanceID, ids, table, foreignKey) {
    await store.exec(`DELETE FROM ${table} WHERE maintenance_id = ?`, [maintenanceID]);
    for (const id of ids) {
        const bean = store.dispense(table);
        bean.import({ maintenance_id: maintenanceID, [foreignKey]: id });
        await store.store(bean);
    }
}

async function replaceRelations(maintenanceID, ids, table, foreignKey) {
    const transaction = await R.begin();
    try {
        await writeRelations(transaction, maintenanceID, ids, table, foreignKey);
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function validateRelations(relations, userID) {
    if (relations === null) {
        return null;
    }
    if (!relations || typeof relations !== "object") {
        throw new Error("Invalid maintenance relations");
    }
    return {
        monitorIDs: await getUniqueRelationIDs(relations.monitors, "monitor", userID),
        statusPageIDs: await getUniqueRelationIDs(relations.statusPages, "status_page"),
    };
}

async function publishMaintenanceList(socket) {
    try {
        await server.sendMaintenanceList(socket);
    } catch (error) {
        log.error("maintenance", `Could not publish maintenance list: ${error.message}`);
    }
}

/**
 * Handlers for Maintenance
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
export const maintenanceSocketHandler = (socket) => {
    // Add a new maintenance
    socket.on("addMaintenance", async (maintenance, relations, callback) => {
        if (typeof relations === "function") {
            callback = relations;
            relations = null;
        }
        let bean;
        let transaction;
        let maintenanceID;
        try {
            checkLogin(socket);

            log.debug("maintenance", maintenance);

            const relationIDs = await validateRelations(relations, socket.userID);
            bean = await Maintenance.jsonToBean(R.dispense("maintenance"), maintenance);
            bean.user_id = socket.userID;
            transaction = await R.begin();
            maintenanceID = await transaction.store(bean);
            if (relationIDs) {
                await writeRelations(
                    transaction,
                    maintenanceID,
                    relationIDs.monitorIDs,
                    "monitor_maintenance",
                    "monitor_id"
                );
                await writeRelations(
                    transaction,
                    maintenanceID,
                    relationIDs.statusPageIDs,
                    "maintenance_status_page",
                    "status_page_id"
                );
            }
            await bean.run(true, true);
            await transaction.commit();
            transaction = null;
        } catch (e) {
            bean?.stop();
            await transaction?.rollback();
            callback({
                ok: false,
                msg: e.message,
            });
            return;
        }
        server.maintenanceList[maintenanceID] = bean;
        clearResponseCache();
        callback({
            ok: true,
            msg: "successAdded",
            msgi18n: true,
            maintenanceID,
        });
        await publishMaintenanceList(socket);
    });

    // Edit a maintenance
    socket.on("editMaintenance", async (maintenance, relations, callback) => {
        if (typeof relations === "function") {
            callback = relations;
            relations = null;
        }
        let bean;
        let draft;
        try {
            checkLogin(socket);

            bean = getOwnedMaintenance(maintenance?.id, socket.userID);
            const relationIDs = await validateRelations(relations, socket.userID);
            draft = await Maintenance.jsonToBean(R.dispense("maintenance").import(bean.export()), maintenance);
            const transaction = await R.begin();
            try {
                bean.stop();
                await transaction.store(draft);
                if (relationIDs) {
                    await writeRelations(
                        transaction,
                        draft.id,
                        relationIDs.monitorIDs,
                        "monitor_maintenance",
                        "monitor_id"
                    );
                    await writeRelations(
                        transaction,
                        draft.id,
                        relationIDs.statusPageIDs,
                        "maintenance_status_page",
                        "status_page_id"
                    );
                }
                await draft.run(true, true);
                await transaction.commit();
            } catch (error) {
                draft.stop();
                await transaction.rollback();
                await bean.run(true, true);
                throw error;
            }
        } catch (e) {
            log.error("maintenance", e);
            callback({
                ok: false,
                msg: e.message,
            });
            return;
        }
        server.maintenanceList[bean.id] = draft;
        clearResponseCache();
        callback({
            ok: true,
            msg: "Saved.",
            msgi18n: true,
            maintenanceID: bean.id,
        });
        await publishMaintenanceList(socket);
    });

    // Add a new monitor_maintenance
    socket.on("addMonitorMaintenance", async (maintenanceID, monitors, callback) => {
        try {
            checkLogin(socket);

            getOwnedMaintenance(maintenanceID, socket.userID);
            const monitorIDs = await getUniqueRelationIDs(monitors, "monitor", socket.userID);

            await replaceRelations(maintenanceID, monitorIDs, "monitor_maintenance", "monitor_id");

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
            // Status pages have no user_id in this SQLite schema, so their ownership is global.
            const statusPageIDs = await getUniqueRelationIDs(statusPages, "status_page");

            await replaceRelations(maintenanceID, statusPageIDs, "maintenance_status_page", "status_page_id");

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
            await R.exec("DELETE FROM maintenance WHERE id = ? AND user_id = ? ", [maintenanceID, socket.userID]);
            maintenance.active = false;
            maintenance.stop();
            delete server.maintenanceList[maintenanceID];

            clearResponseCache();

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
            });

            await publishMaintenanceList(socket);
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

            const active = maintenance.active;
            maintenance.active = false;
            try {
                await R.store(maintenance);
            } catch (error) {
                maintenance.active = active;
                throw error;
            }
            maintenance.stop();

            clearResponseCache();

            callback({
                ok: true,
                msg: "successPaused",
                msgi18n: true,
            });

            await publishMaintenanceList(socket);
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

            const active = maintenance.active;
            maintenance.active = true;
            try {
                await R.store(maintenance);
                await maintenance.run(true, true);
            } catch (error) {
                maintenance.stop();
                maintenance.active = active;
                await R.store(maintenance);
                throw error;
            }

            clearResponseCache();

            callback({
                ok: true,
                msg: "successResumed",
                msgi18n: true,
            });

            await publishMaintenanceList(socket);
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
