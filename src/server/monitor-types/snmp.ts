// @ts-nocheck

import { MonitorType } from "@/server/monitor-types/monitor-type";
import { MAX_INTERVAL_SECOND, MAX_MONITOR_RETRIES, MIN_PROVIDER_TIMEOUT_SECOND, UP } from "@/constants";
import { evaluateJsonQuery } from "@/server/json-query";
import { log } from "@/server/logger";
import snmp from "net-snmp";

class SNMPMonitorType extends MonitorType {
    name = "snmp";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let session;
        let sessionClosed = false;
        const closeSession = () => {
            if (session && !sessionClosed) {
                session.close();
                sessionClosed = true;
            }
        };
        try {
            const configuredRetries = Number(monitor.maxretries);
            const retries =
                Number.isSafeInteger(configuredRetries) &&
                configuredRetries >= 0 &&
                configuredRetries <= MAX_MONITOR_RETRIES
                    ? configuredRetries
                    : 0;
            const configuredTimeout = monitor.getEffectiveTimeout?.() ?? Number(monitor.timeout);
            const timeout =
                Number.isFinite(configuredTimeout) &&
                configuredTimeout >= MIN_PROVIDER_TIMEOUT_SECOND &&
                configuredTimeout <= MAX_INTERVAL_SECOND
                    ? configuredTimeout * 1000
                    : 20_000;
            const sessionOptions = {
                port: monitor.port || "161",
                retries,
                timeout: Math.max(1, timeout / (retries + 1)),
                version: snmp.Version[monitor.snmpVersion],
            };

            if (monitor.snmpVersion === "3") {
                if (!monitor.snmp_v3_username) {
                    throw new Error("SNMPv3 username is required");
                }
                // SNMPv3 currently defaults to noAuthNoPriv.
                // Supporting authNoPriv / authPriv requires additional inputs
                // (auth/priv protocols, passwords), validation, secure storage,
                // and database migrations, which is intentionally left for
                // a follow-up PR to keep this change scoped.
                sessionOptions.securityLevel = snmp.SecurityLevel.noAuthNoPriv;
                sessionOptions.username = monitor.snmp_v3_username;
                session = snmp.createV3Session(monitor.hostname, monitor.snmp_v3_username, sessionOptions);
            } else {
                session = snmp.createSession(monitor.hostname, monitor.radiusPassword, sessionOptions);
            }

            const varbinds = await new Promise((resolve, reject) => {
                let settled = false;
                let timeoutID;
                const onError = (error) => finish(new Error(`Error creating SNMP session: ${error.message}`));
                const finish = (error, value) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    clearTimeout(timeoutID);
                    session.removeListener?.("error", onError);
                    error ? reject(error) : resolve(value);
                };

                try {
                    session.on("error", onError);
                    timeoutID = setTimeout(() => {
                        const error = new Error(`SNMP request timed out after ${timeout / 1000} seconds`);
                        try {
                            session.cancelRequests?.(error);
                        } catch {}
                        finish(error);
                        try {
                            closeSession();
                        } catch {}
                    }, timeout);
                    session.get([monitor.snmpOid], (error, value) => finish(error, value));
                } catch (error) {
                    finish(error);
                }
            });
            if (varbinds.length === 0) {
                throw new Error(`No varbinds returned from SNMP session (OID: ${monitor.snmpOid})`);
            }

            log.debug(
                this.name,
                `SNMP: Received varbinds (Type: ${snmp.ObjectType[varbinds[0].type]} Value: ${varbinds[0].value})`
            );

            if (varbinds[0].type === snmp.ObjectType.NoSuchInstance) {
                throw new Error(`The SNMP query returned that no instance exists for OID ${monitor.snmpOid}`);
            }

            // We restrict querying to one OID per monitor, therefore `varbinds[0]` will always contain the value we're interested in.
            const value = varbinds[0].value;

            const { status, response } = await evaluateJsonQuery(
                value,
                monitor.jsonPath,
                monitor.jsonPathOperator,
                monitor.expectedValue
            );

            if (status) {
                heartbeat.status = UP;
                heartbeat.msg = `JSON query passes (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`;
            } else {
                throw new Error(
                    `JSON query does not pass (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`
                );
            }
        } finally {
            closeSession();
        }
    }
}

export { SNMPMonitorType };
