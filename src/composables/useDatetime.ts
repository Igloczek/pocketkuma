// @ts-nocheck
import { ref, computed } from "vue";
import dayjs from "dayjs";

const userTimezone = ref(localStorage.timezone || "auto");

const timezone = computed(() => {
    if (userTimezone.value === "auto") {
        return dayjs.tz.guess();
    }
    return userTimezone.value;
});

/**
 * Return a value in a custom format
 * @param {any} value Value to format
 * @param {any} format Format to return value in
 * @returns {string} Formatted string
 */
function datetimeFormat(value, format) {
    if (value !== undefined && value !== "") {
        return dayjs.utc(value).tz(timezone.value).format(format);
    }
    return "";
}

/**
 * Convert value to UTC
 * @param {string | number | Date | dayjs.Dayjs} value Time value to convert
 * @returns {string} Converted time
 */
function toUTC(value) {
    return dayjs.tz(value, timezone.value).utc().format();
}

/**
 * Used for <input type="datetime" />
 * @param {string | number | Date | dayjs.Dayjs} value Value to convert
 * @returns {string} Datetime string
 */
function toDateTimeInputFormat(value) {
    return datetimeFormat(value, "YYYY-MM-DDTHH:mm");
}

/**
 * Return a given value in the format YYYY-MM-DD HH:mm:ss
 * @param {any} value Value to format as date time
 * @returns {string} Formatted string
 */
function datetime(value) {
    return datetimeFormat(value, "YYYY-MM-DD HH:mm:ss");
}

/**
 * Converts a Unix timestamp to a formatted date and time string.
 * @param {number} value The Unix timestamp to convert.
 * @returns {string} The formatted date and time string.
 */
function unixToDateTime(value) {
    return dayjs.unix(value).tz(timezone.value).format("YYYY-MM-DD HH:mm:ss");
}

/**
 * Converts a Unix timestamp to a dayjs object.
 * @param {number} value The Unix timestamp to convert.
 * @returns {dayjs.Dayjs} The dayjs object representing the given timestamp.
 */
function unixToDayjs(value) {
    return dayjs.unix(value).tz(timezone.value);
}

/**
 * Converts the given value to a dayjs object.
 * @param {string} value the value to be converted
 * @returns {dayjs.Dayjs} a dayjs object in the configured timezone
 */
function toDayjs(value) {
    return dayjs.utc(value).tz(timezone.value);
}

/**
 * Get time for maintenance
 * @param {string | number | Date | dayjs.Dayjs} value Time to format
 * @returns {string} Formatted string
 */
function datetimeMaintenance(value) {
    const inputDate = new Date(value);
    const now = new Date(Date.now());

    if (
        inputDate.getFullYear() === now.getUTCFullYear() &&
        inputDate.getMonth() === now.getUTCMonth() &&
        inputDate.getDay() === now.getUTCDay()
    ) {
        return datetimeFormat(value, "HH:mm");
    }
    return datetimeFormat(value, "YYYY-MM-DD HH:mm");
}

/**
 * Return a given value in the format YYYY-MM-DD
 * @param {any} value Value to format as date
 * @returns {string} Formatted string
 */
function date(value) {
    return datetimeFormat(value, "YYYY-MM-DD");
}

/**
 * Return a given value in the format HH:mm or HH:mm:ss
 * @param {any} value Value to format
 * @param {boolean} second Should seconds be included?
 * @returns {string} Formatted string
 */
function time(value, second = true) {
    const secondString = second ? ":ss" : "";
    return datetimeFormat(value, "HH:mm" + secondString);
}

/**
 * Datetime formatting helpers shared across the app.
 * @returns {object} Datetime composable API
 */
export function useDatetime() {
    return {
        userTimezone,
        timezone,
        toUTC,
        toDateTimeInputFormat,
        datetime,
        unixToDateTime,
        unixToDayjs,
        toDayjs,
        datetimeMaintenance,
        date,
        time,
        datetimeFormat,
    };
}
