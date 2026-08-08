const getRandomBytes = (
    typeof window !== "undefined" && window.crypto
        ? () => (numBytes: number) => {
              const randomBytes = new Uint8Array(numBytes);
              for (let index = 0; index < numBytes; index += 65536) {
                  window.crypto.getRandomValues(randomBytes.subarray(index, index + Math.min(numBytes - index, 65536)));
              }
              return randomBytes;
          }
        : () => (numBytes: number) => {
              const bytes = new Uint8Array(numBytes);
              crypto.getRandomValues(bytes);
              return Buffer.from(bytes);
          }
)();

export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getCryptoRandomInt(min: number, max: number): number {
    const range = max - min;
    if (range >= 2 ** 32) {
        console.log("Warning! Range is too large.");
    }

    let tmpRange = range;
    let bitsNeeded = 0;
    let bytesNeeded = 0;
    let mask = 1;
    while (tmpRange > 0) {
        if (bitsNeeded % 8 === 0) {
            bytesNeeded += 1;
        }
        bitsNeeded += 1;
        mask = (mask << 1) | 1;
        tmpRange >>>= 1;
    }

    const randomBytes = getRandomBytes(bytesNeeded);
    let randomValue = 0;
    for (let index = 0; index < bytesNeeded; index++) {
        randomValue |= randomBytes[index] << (8 * index);
    }
    randomValue &= mask;

    return randomValue <= range ? min + randomValue : getCryptoRandomInt(min, max);
}

export function genSecret(length = 64) {
    let secret = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let index = 0; index < length; index++) {
        secret += chars.charAt(getCryptoRandomInt(0, chars.length - 1));
    }
    return secret;
}
