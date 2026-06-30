// @ts-nocheck

import iconv from "iconv-lite";
import chardet from "chardet";

/**
 * Convert unknown string to UTF8
 * @param {Uint8Array} body Buffer
 * @returns {string} UTF8 string
 */
export const convertToUTF8 = (body) => {
    const guessEncoding = chardet.detect(body);
    const str = iconv.decode(body, guessEncoding);
    return str.toString();
};