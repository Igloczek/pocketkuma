// @ts-nocheck

/**
 * Decode a JWT payload without verifying the signature.
 * @param {string} token JWT to decode.
 * @returns {object} Decoded payload.
 */
function jwtDecode(token) {
    const parts = token.split(".");
    if (parts.length < 2) {
        throw new Error("Invalid token");
    }

    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4 !== 0) {
        payload += "=";
    }

    const json = atob(payload);
    return JSON.parse(json);
}

export { jwtDecode };

export default jwtDecode;
