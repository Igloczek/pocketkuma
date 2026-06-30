// @ts-nocheck

/**
 * Thin re-export barrel for server utilities split by domain.
 * Prefer importing from the specific module when adding new code.
 */

export { setting, setSetting, getSettings, setSettings } from "@/server/settings-helpers";
export { convertToUTF8 } from "@/server/encoding";
export { radius } from "@/server/radius";
export { ping, pingAsync } from "@/server/ping";
export { kafkaProducerAsync } from "@/server/kafka";
export {
    getDaysRemaining,
    checkCertificate,
    checkCertificateHostname,
    rootCertificatesFingerprints,
    checkCertExpiryNotifications,
    __test,
    __getPrivateFunction,
} from "@/server/tls-cert";
export {
    initJWTSecret,
    decodeJwt,
    getOidcTokenClientCredentials,
    checkLogin,
    doubleCheckPassword,
} from "@/server/server-auth-helpers";
export {
    checkStatusCode,
    allowDevAllOrigin,
    allowAllOrigin,
    sendHttpError,
    encodeBase64,
    axiosAbortSignal,
} from "@/server/http-utils";
export { timeObjectToUTC, timeObjectToLocal } from "@/server/time-object";
export { printServerUrls } from "@/server/server-urls";
export {
    getTotalClientInRoom,
    percentageToColor,
    filterAndJoin,
    shake256,
    SHAKE256_LENGTH,
    wait,
    fsExists,
} from "@/server/shared-helpers";

export { commandExists } from "@/server/process-helper";