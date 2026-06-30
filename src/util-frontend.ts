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

const durationFormatOptions = { style: "long" };
const relativeTimeFormatOptions = { numeric: "always" };

let durationFormatLocale = currentLocale();
/** @type {Intl.DurationFormat | undefined} */
let durationFormatInstance;
/** @type {Intl.RelativeTimeFormat | undefined} */
let relativeTimeFormatInstance;

function initDurationFormatters() {
    if (Intl.DurationFormat !== undefined) {
        durationFormatInstance = new Intl.DurationFormat(durationFormatLocale, durationFormatOptions);
        relativeTimeFormatInstance = undefined;
    } else {
        durationFormatInstance = undefined;
        relativeTimeFormatInstance = new Intl.RelativeTimeFormat(durationFormatLocale, relativeTimeFormatOptions);
    }
}

initDurationFormatters();

/**
 * Update locale used for duration formatting.
 * @param {string} locale Localization identifier (e.g., "en", "ar-sy").
 * @returns {void}
 */
export function setDurationFormatLocale(locale) {
    durationFormatLocale = locale;
    initDurationFormatters();
}

/**
 * Convert seconds into a human-readable duration string.
 * @param {number} seconds Value in seconds.
 * @returns {string} Localized duration (days, hours, minutes, seconds).
 */
export function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor(((seconds % 86400) % 3600) / 60);
    const secs = ((seconds % 86400) % 3600) % 60;

    if (durationFormatInstance !== undefined) {
        return durationFormatInstance.format({
            days,
            hours,
            minutes,
            seconds: secs,
        });
    }

    const parts = [];
    const toFormattedPart = (value, unitOfTime) => {
        const partsArray = relativeTimeFormatInstance.formatToParts(value, unitOfTime);
        const filteredParts = partsArray
            .filter((part, index) => part.type === "integer" || (part.type === "literal" && index > 0))
            .map((part) => part.value);

        parts.push(filteredParts.join("").trim());
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
        return parts.join(" ");
    }
    return relativeTimeFormatInstance.format(0, "second");
}
