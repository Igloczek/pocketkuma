// @ts-nocheck

/**
 * Split SQL into statements, respecting single-quoted string literals.
 * Semicolons inside '...' literals do not terminate a statement.
 */
export function parseSqlStatements(sql) {
    const lines = sql
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n");

    const statements = [];
    let current = "";
    let inSingleQuote = false;

    for (let i = 0; i < lines.length; i++) {
        const char = lines[i];

        if (char === "'") {
            if (inSingleQuote && lines[i + 1] === "'") {
                current += "''";
                i++;
                continue;
            }
            inSingleQuote = !inSingleQuote;
            current += char;
            continue;
        }

        if (char === ";" && !inSingleQuote) {
            const trimmed = current.trim();
            if (trimmed.length > 0) {
                statements.push(trimmed);
            }
            current = "";
            continue;
        }

        current += char;
    }

    const trailing = current.trim();
    if (trailing.length > 0) {
        statements.push(trailing);
    }

    return statements;
}

export function applySqlFile(db, sql) {
    for (const statement of parseSqlStatements(sql)) {
        db.run(statement);
    }
}