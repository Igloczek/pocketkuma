// @ts-nocheck

import { MonitorType } from "./monitor-type.ts";
import { UP } from "../../util.ts";
import { GameDig } from "gamedig";

class GameDigMonitorType extends MonitorType {
    name = "gamedig";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        try {
            const state = await GameDig.query({
                type: monitor.game,
                host: monitor.hostname,
                port: monitor.port,
                givenPortOnly: Boolean(monitor.gamedigGivenPortOnly),
                ...(monitor.gamedigToken ? { token: monitor.gamedigToken } : {}),
            });

            heartbeat.msg = state.name;
            heartbeat.status = UP;
            heartbeat.ping = state.ping;
        } catch (e) {
            throw new Error(e.message);
        }
    }
}

export { GameDigMonitorType };
