/** RFC 2865 attribute names used by the RADIUS monitor. */
export const RADIUS_ATTRS = {
    USER_NAME: "User-Name",
    USER_PASSWORD: "User-Password",
    CALLING_STATION_ID: "Calling-Station-Id",
    CALLED_STATION_ID: "Called-Station-Id",
} as const;