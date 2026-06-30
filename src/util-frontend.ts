// @ts-nocheck
import dayjs from "dayjs";
import { localeDirection, currentLocale } from "@/i18n";
import { POSITION } from "vue-toastification";

const FALLBACK_TIME_ZONES = [
    "UTC",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "America/Anchorage",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/New_York",
    "America/Sao_Paulo",
    "America/Toronto",
    "Asia/Bangkok",
    "Asia/Dubai",
    "Asia/Hong_Kong",
    "Asia/Jakarta",
    "Asia/Kolkata",
    "Asia/Seoul",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Europe/Amsterdam",
    "Europe/Berlin",
    "Europe/London",
    "Europe/Moscow",
    "Europe/Paris",
    "Pacific/Auckland",
    "Pacific/Honolulu",
];

/**
 * Returns IANA timezone identifiers supported by the current engine.
 * @returns {string[]} Supported timezone names.
 */
function getSupportedTimeZones() {
    if (typeof Intl.supportedValuesOf === "function") {
        try {
            return Intl.supportedValuesOf("timeZone");
        } catch {
            // Fall through to the static list for older engines.
        }
    }

    return FALLBACK_TIME_ZONES;
}

/**
 * Returns the offset from UTC in hours for a timezone.
 * @param {string} timeZone Timezone to get offset for
 * @param {Date} [date] Date used for DST-aware offsets
 * @returns {number} The offset from UTC in hours.
 */
function getTimezoneOffsetHours(timeZone, date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset",
    }).formatToParts(date);
    const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";

    if (offsetPart === "GMT" || offsetPart === "UTC") {
        return 0;
    }

    const match = offsetPart.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) {
        return 0;
    }

    const sign = match[1] === "+" ? 1 : -1;
    const hours = Number.parseInt(match[2], 10);
    const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
    return sign * (hours + minutes / 60);
}

/**
 * Returns a list of timezones sorted by their offset from UTC.
 * @returns {object[]} A list of the given timezones sorted by their offset from UTC.
 */
export function timezoneList() {
    let result = [];
    const timeZones = getSupportedTimeZones();

    for (let timezone of timeZones) {
        try {
            let display = dayjs().tz(timezone).format("Z");

            result.push({
                name: `(UTC${display}) ${timezone}`,
                value: timezone,
                time: getTimezoneOffsetHours(timezone),
            });
        } catch (e) {
            // Skipping not supported timezone by dayjs
        }
    }

    result.sort((a, b) => {
        if (a.time !== b.time) {
            return a.time - b.time;
        }

        return a.value.localeCompare(b.value);
    });

    return result;
}

/**
 * Set the locale of the HTML page
 * @returns {void}
 */
export function setPageLocale() {
    const html = document.documentElement;
    html.setAttribute("lang", currentLocale());
    html.setAttribute("dir", localeDirection());
}

/**
 * Get the base URL
 * Mainly used for dev, because the backend and the frontend are in different ports.
 * @returns {string} Base URL
 */
export function getResBaseURL() {
    const env = process.env.NODE_ENV;
    if (env === "development" && isDevContainer()) {
        return location.protocol + "//" + getDevContainerServerHostname();
    } else if (env === "development" || localStorage.dev === "dev") {
        return location.protocol + "//" + location.hostname + ":3001";
    } else {
        return "";
    }
}

/**
 * Are we currently running in a dev container?
 * @returns {boolean} Running in dev container?
 */
export function isDevContainer() {
    // eslint-disable-next-line no-undef
    return typeof DEVCONTAINER === "string" && DEVCONTAINER === "1";
}

/**
 * Supports GitHub Codespaces only currently
 * @returns {string} Dev container server hostname
 */
export function getDevContainerServerHostname() {
    if (!isDevContainer()) {
        return "";
    }

    // eslint-disable-next-line no-undef
    return CODESPACE_NAME + "-3001." + GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
}

/**
 * Get the tag color options
 * Shared between components
 * @param {any} self Component
 * @returns {object[]} Colour options
 */
export function colorOptions(self) {
    return [
        { name: self.$t("Gray"), color: "#4B5563" },
        { name: self.$t("Red"), color: "#DC2626" },
        { name: self.$t("Orange"), color: "#D97706" },
        { name: self.$t("Green"), color: "#059669" },
        { name: self.$t("Blue"), color: "#2563EB" },
        { name: self.$t("Indigo"), color: "#4F46E5" },
        { name: self.$t("Purple"), color: "#7C3AED" },
        { name: self.$t("Pink"), color: "#DB2777" },
    ];
}

/**
 * Loads the toast timeout settings from storage.
 * @returns {object} The toast plugin options object.
 */
export function loadToastSettings() {
    return {
        position: POSITION.BOTTOM_RIGHT,
        containerClassName: "toast-container mb-5",
        showCloseButtonOnHover: true,

        filterBeforeCreate: (toast, toasts) => {
            if (toast.timeout === 0) {
                return false;
            } else {
                return toast;
            }
        },
    };
}

/**
 * Get timeout for success toasts
 * @returns {(number|boolean)} Timeout in ms. If false timeout disabled.
 */
export function getToastSuccessTimeout() {
    let successTimeout = 20000;

    if (localStorage.toastSuccessTimeout !== undefined) {
        const parsedTimeout = parseInt(localStorage.toastSuccessTimeout);
        if (parsedTimeout != null && !Number.isNaN(parsedTimeout)) {
            successTimeout = parsedTimeout;
        }
    }

    if (successTimeout === -1) {
        successTimeout = false;
    }

    return successTimeout;
}

/**
 * Get timeout for error toasts
 * @returns {(number|boolean)} Timeout in ms. If false timeout disabled.
 */
export function getToastErrorTimeout() {
    let errorTimeout = -1;

    if (localStorage.toastErrorTimeout !== undefined) {
        const parsedTimeout = parseInt(localStorage.toastErrorTimeout);
        if (parsedTimeout != null && !Number.isNaN(parsedTimeout)) {
            errorTimeout = parsedTimeout;
        }
    }

    if (errorTimeout === -1) {
        errorTimeout = false;
    }

    return errorTimeout;
}

class TimeDurationFormatter {
    /**
     * Default locale and options for Time Duration Formatter (supports both DurationFormat and RelativeTimeFormat)
     */
    constructor() {
        this.durationFormatOptions = { style: "long" };
        this.relativeTimeFormatOptions = { numeric: "always" };
        if (Intl.DurationFormat !== undefined) {
            this.durationFormatInstance = new Intl.DurationFormat(currentLocale(), this.durationFormatOptions);
        } else {
            this.relativeTimeFormatInstance = new Intl.RelativeTimeFormat(
                currentLocale(),
                this.relativeTimeFormatOptions
            );
        }
    }

    /**
     * Method to update the instance locale and options
     * @param {string} locale Localization identifier (e.g., "en", "ar-sy") to update the instance with.
     * @returns {void} No return value.
     */
    updateLocale(locale) {
        if (Intl.DurationFormat !== undefined) {
            this.durationFormatInstance = new Intl.DurationFormat(locale, this.durationFormatOptions);
        } else {
            this.relativeTimeFormatInstance = new Intl.RelativeTimeFormat(locale, this.relativeTimeFormatOptions);
        }
    }

    /**
     * Method to convert seconds into Human readable format
     * @param {number} seconds Receive value in seconds.
     * @returns {string} String converted to Days Mins Seconds Format
     */
    secondsToHumanReadableFormat(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor(((seconds % 86400) % 3600) / 60);
        const secs = ((seconds % 86400) % 3600) % 60;

        if (this.durationFormatInstance !== undefined) {
            // use Intl.DurationFormat if available
            return this.durationFormatInstance.format({
                days,
                hours,
                minutes,
                seconds: secs,
            });
        }

        const parts = [];
        /**
         * Build the formatted string from parts
         * 1. Get the relative time formatted parts from the instance.
         * 2. Filter out the relevant parts literal (unit of time) or integer (value).
         * 3. Map out the required values.
         * @param {number} value Receives value in seconds.
         * @param {string} unitOfTime Expected unit of time after conversion.
         * @returns {void}
         */
        const toFormattedPart = (value, unitOfTime) => {
            const partsArray = this.relativeTimeFormatInstance.formatToParts(value, unitOfTime);
            const filteredParts = partsArray
                .filter((part, index) => part.type === "integer" || (part.type === "literal" && index > 0))
                .map((part) => part.value);

            const formattedString = filteredParts.join("").trim();
            parts.push(formattedString);
        };

        if (days > 0) {
            toFormattedPart(days, "day");
        }
        if (hours > 0) {
            toFormattedPart(hours, "hour");
        }
        if (minutes > 0) {
            toFormattedPart(minutes, "minute");
        }
        if (secs > 0) {
            toFormattedPart(secs, "second");
        }

        if (parts.length > 0) {
            return `${parts.join(" ")}`;
        }
        return this.relativeTimeFormatInstance.format(0, "second"); // Handle case for 0 seconds
    }
}

export const timeDurationFormatter = new TimeDurationFormatter();
