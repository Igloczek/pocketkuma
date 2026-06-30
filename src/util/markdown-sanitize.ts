import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Convert markdown to sanitized HTML.
 * @param {string | null | undefined} content Markdown content
 * @returns {string} Sanitized HTML
 */
export function sanitizeMarkdown(content: string | null | undefined): string {
    if (content != null && content !== "") {
        return DOMPurify.sanitize(marked(content));
    }
    return "";
}
