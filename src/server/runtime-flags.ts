export const isDev = process.env.NODE_ENV === "development";
export const isNode = typeof process !== "undefined" && process?.versions?.node;

declare global {
    interface String {
        replaceAll(str: string, newStr: string): string;
    }
}

export function polyfill() {
    if (!String.prototype.replaceAll) {
        (String.prototype as any).replaceAll = function (str: string, newStr: string) {
            if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") {
                return this.replace(str, newStr);
            }

            return this.replace(new RegExp(str, "g"), newStr);
        };
    }
}
