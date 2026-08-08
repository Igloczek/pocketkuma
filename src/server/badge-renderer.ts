const STYLES = new Set(["plastic", "flat", "flat-square", "for-the-badge", "social"]);

const NAMED_COLORS = {
    brightgreen: "#4c1",
    green: "#97ca00",
    yellow: "#dfb317",
    yellowgreen: "#a4a61d",
    orange: "#fe7d37",
    red: "#e05d44",
    blue: "#007ec6",
    grey: "#555",
    lightgrey: "#9f9f9f",
};

const COLOR_ALIASES = {
    gray: "grey",
    lightgray: "lightgrey",
    critical: "red",
    important: "orange",
    success: "brightgreen",
    informational: "blue",
    inactive: "lightgrey",
};
const GRAPHEMES = new Intl.Segmenter("en", { granularity: "grapheme" });

function escapeXml(value: unknown) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

function normalizeColor(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
        return undefined;
    }
    let color = value.trim().toLowerCase();
    color = COLOR_ALIASES[color] || color;
    if (NAMED_COLORS[color]) {
        return NAMED_COLORS[color];
    }
    if (/^#?[\da-f]{3,4}(?:[\da-f]{3,4})?$/i.test(color)) {
        color = color.startsWith("#") ? color : `#${color}`;
    }
    const alpha = color.includes("/")
        ? color.match(/\/\s*([+-]?(?:\d+\.?\d*|\.\d+)%?)/)?.[1]
        : /^(?:rgba|hsla)\(/.test(color)
          ? color.match(/,\s*([+-]?(?:\d+\.?\d*|\.\d+)%?)\s*\)$/)?.[1]
          : undefined;
    if (alpha) {
        const value = Number.parseFloat(alpha);
        if (value < 0 || value > (alpha.endsWith("%") ? 100 : 1)) {
            return undefined;
        }
    }
    return Bun.color(color, "rgba") ? color : undefined;
}

function textColor(background: string) {
    const rgb = Bun.color(background, "rgba")
        ?.match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number);
    if (!rgb) {
        return "#fff";
    }
    return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 255000 > 0.69 ? "#333" : "#fff";
}

function textWidth(text: string, size = 11, bold = false) {
    const units = [...GRAPHEMES.segment(text)].reduce((width, { segment }) => {
        const character = segment.normalize("NFC");
        if (/\s/.test(character)) {
            return width + 0.4;
        }
        if (/[ilI1.,'`]/.test(character)) {
            return width + 0.45;
        }
        if (/[MW@#%&]/.test(character) || character.codePointAt(0)! > 0xff) {
            return width + 1;
        }
        return width + 0.65;
    }, 0);
    return Math.max(1, Math.ceil(units * size * (bold ? 1.04 : 1)));
}

function fitText(width: number) {
    return ` textLength="${width}" lengthAdjust="spacingAndGlyphs"`;
}

function svgFrame(width: number, height: number, label: string, message: string, body: string) {
    const accessible = escapeXml(label ? `${label}: ${message}` : message);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="${accessible}"><title>${accessible}</title>${body}</svg>`;
}

function renderStandard(
    label: string,
    message: string,
    color: string,
    labelColor: string,
    style: string,
    forceLabel: boolean
) {
    const height = style === "plastic" ? 18 : 20;
    const radius = style === "plastic" ? 4 : 3;
    const labelTextWidth = label ? textWidth(label) : 0;
    const messageTextWidth = textWidth(message);
    const leftWidth = label || forceLabel ? labelTextWidth + 10 : 0;
    const rightWidth = messageTextWidth + 10;
    const width = leftWidth + rightWidth;
    const y = style === "plastic" ? 13 : 14;
    const labelText = label
        ? `<text x="${leftWidth / 2}" y="${y}" fill="${textColor(labelColor)}"${fitText(labelTextWidth)}>${escapeXml(label)}</text>`
        : "";
    const messageText = `<text x="${leftWidth + rightWidth / 2}" y="${y}" fill="${textColor(color)}"${fitText(messageTextWidth)}>${escapeXml(message)}</text>`;
    const rects = `<rect width="${leftWidth}" height="${height}" fill="${escapeXml(labelColor)}"/><rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${escapeXml(color)}"/>`;
    const backgrounds =
        style === "flat-square"
            ? `<g shape-rendering="crispEdges">${rects}</g>`
            : `<defs><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity="${style === "plastic" ? ".7" : ".1"}"/><stop offset="1" stop-opacity="${style === "plastic" ? ".35" : ".1"}"/></linearGradient><clipPath id="r"><rect width="${width}" height="${height}" rx="${radius}"/></clipPath></defs><g clip-path="url(#r)">${rects}<rect width="${width}" height="${height}" fill="url(#s)"/></g>`;
    return svgFrame(
        width,
        height,
        label,
        message,
        `${backgrounds}<g text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">${labelText}${messageText}</g>`
    );
}

function renderForTheBadge(label: string, message: string, color: string, labelColor: string) {
    label = label.toUpperCase();
    message = message.toUpperCase();
    const leftWidth = label ? textWidth(label, 10, true) + 24 : 0;
    const rightWidth = textWidth(message, 10, true) + 24;
    const width = leftWidth + rightWidth;
    const labelText = label
        ? `<text x="${leftWidth / 2}" y="18" fill="${textColor(labelColor)}"${fitText(leftWidth - 24)}>${escapeXml(label)}</text>`
        : "";
    return svgFrame(
        width,
        28,
        label,
        message,
        `<g shape-rendering="crispEdges"><rect width="${leftWidth}" height="28" fill="${escapeXml(labelColor)}"/><rect x="${leftWidth}" width="${rightWidth}" height="28" fill="${escapeXml(color)}"/></g><g text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="10" font-weight="bold" letter-spacing="1.25">${labelText}<text x="${leftWidth + rightWidth / 2}" y="18" fill="${textColor(color)}"${fitText(rightWidth - 24)}>${escapeXml(message)}</text></g>`
    );
}

function renderSocial(label: string, message: string) {
    label = label ? `${label[0].toUpperCase()}${label.slice(1)}` : "";
    const leftWidth = textWidth(label, 11, true) + 10;
    const rightWidth = message ? textWidth(message, 11, true) + 14 : 0;
    const width = leftWidth + rightWidth;
    const messageBody = message
        ? `<path d="M${leftWidth + 4} 7l-3 3 3 3" fill="#fafafa" stroke="#d5d5d5"/><rect x="${leftWidth + 6}" y=".5" width="${rightWidth - 6}" height="19" rx="2" fill="#fafafa" stroke="#d5d5d5"/><text x="${leftWidth + 6 + (rightWidth - 6) / 2}" y="14"${fitText(rightWidth - 14)}>${escapeXml(message)}</text>`
        : "";
    return svgFrame(
        width,
        20,
        label,
        message,
        `<rect x=".5" y=".5" width="${leftWidth - 1}" height="19" rx="2" fill="#fcfcfc" stroke="#d5d5d5"/><g fill="#333" text-anchor="middle" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="11" font-weight="bold"><text x="${leftWidth / 2}" y="14"${fitText(leftWidth - 10)}>${escapeXml(label)}</text>${messageBody}</g>`
    );
}

export function renderBadge({
    label = "",
    message,
    color,
    labelColor,
    style = "flat",
}: {
    label?: string;
    message: string;
    color?: string;
    labelColor?: string;
    style?: string;
}) {
    if (typeof message !== "string") {
        throw new TypeError("Badge message must be a string");
    }
    if (!STYLES.has(style)) {
        throw new TypeError(`Unknown badge style: '${style}'`);
    }
    label = String(label).trim();
    message = message.trim();
    const normalizedColor = normalizeColor(color) || "#4c1";
    const normalizedLabelColor = normalizeColor(labelColor);
    if (style === "social") {
        return renderSocial(label, message);
    }
    if (style === "for-the-badge") {
        return renderForTheBadge(label, message, normalizedColor, normalizedLabelColor || "#555");
    }
    return renderStandard(
        label,
        message,
        normalizedColor,
        normalizedLabelColor || "#555",
        style,
        Boolean(normalizedLabelColor)
    );
}

export function percentageToColor(percentage: number, maxHue = 90, minHue = 10) {
    if (!Number.isFinite(percentage)) {
        return "#999";
    }
    const hue = percentage * (maxHue - minHue) + minHue;
    return Bun.color(`hsl(${hue}, 90%, 40%)`, "hex") || "#999";
}

export function filterAndJoin(parts: unknown[], connector = "") {
    return parts.filter((part) => Boolean(part) && part !== "").join(connector);
}
