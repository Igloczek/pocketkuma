import type { ConfigType } from "dayjs";

declare module "dayjs" {
    interface Dayjs {
        utc(keepLocalTime?: boolean): Dayjs;
        local(): Dayjs;
        isUTC(): boolean;
        utcOffset(offset: number | string, keepLocalTime?: boolean): Dayjs;
        tz(timezone?: string, keepLocalTime?: boolean): Dayjs;
        offsetName(type?: "short" | "long"): string | undefined;
    }

    interface DayjsTimezone {
        (date?: ConfigType, timezone?: string): Dayjs;
        (date: ConfigType, format: string, timezone?: string): Dayjs;
        guess(): string;
        setDefault(timezone?: string): void;
    }

    function utc(config?: ConfigType, format?: string, strict?: boolean): Dayjs;

    const tz: DayjsTimezone;
}