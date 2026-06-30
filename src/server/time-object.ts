// @ts-nocheck

import dayjs from "dayjs";

/**
 * Convert timezone of time object
 * @param {object} obj Time object to update
 * @param {string} timezone New timezone to set
 * @param {boolean} timeObjectToUTC Convert time object to UTC
 * @returns {object} Time object with updated timezone
 */
function timeObjectConvertTimezone(obj, timezone, timeObjectToUTC = true) {
    let offsetString;

    if (timezone) {
        offsetString = dayjs().tz(timezone).format("Z");
    } else {
        offsetString = dayjs().format("Z");
    }

    let hours = parseInt(offsetString.substring(1, 3));
    let minutes = parseInt(offsetString.substring(4, 6));

    if ((timeObjectToUTC && offsetString.startsWith("+")) || (!timeObjectToUTC && offsetString.startsWith("-"))) {
        hours *= -1;
        minutes *= -1;
    }

    obj.hours += hours;
    obj.minutes += minutes;

    // Handle out of bound
    if (obj.minutes < 0) {
        obj.minutes += 60;
        obj.hours--;
    } else if (obj.minutes > 60) {
        obj.minutes -= 60;
        obj.hours++;
    }

    if (obj.hours < 0) {
        obj.hours += 24;
    } else if (obj.hours > 24) {
        obj.hours -= 24;
    }

    return obj;
}

/**
 * Convert time object to UTC
 * @param {object} obj Object to convert
 * @param {string} timezone Timezone of time object
 * @returns {object} Updated time object
 */
export const timeObjectToUTC = (obj, timezone = undefined) => {
    return timeObjectConvertTimezone(obj, timezone, true);
};

/**
 * Convert time object to local time
 * @param {object} obj Object to convert
 * @param {string} timezone Timezone to convert to
 * @returns {object} Updated object
 */
export const timeObjectToLocal = (obj, timezone = undefined) => {
    return timeObjectConvertTimezone(obj, timezone, false);
};