import chroma from "chroma-js";
import { badgeConstants } from "@/constants";

export function percentageToColor(percentage, maxHue = 90, minHue = 10) {
    const hue = percentage * (maxHue - minHue) + minHue;
    try {
        return chroma(`hsl(${hue}, 90%, 40%)`).hex();
    } catch {
        return badgeConstants.naColor;
    }
}

export function filterAndJoin(parts, connector = "") {
    return parts.filter((part) => !!part && part !== "").join(connector);
}
