import dayjs from "dayjs";
import { isDev } from "@/server/runtime-flags";

export class TimeLogger {
    startTime = dayjs().valueOf();

    print(name: string) {
        if (isDev && process.env.TIMELOGGER === "1") {
            console.log(name + ": " + (dayjs().valueOf() - this.startTime) + "ms");
        }
    }
}
