/**
 * @param {import("knex").Knex} knex The Knex.js instance for database interaction.
 * @returns {Promise<void>}
 */
export const up = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.string("system_service_name");
    });
};

/**
 * @param {import("knex").Knex} knex The Knex.js instance for database interaction.
 * @returns {Promise<void>}
 */
export const down = async (knex) => {
    await knex.schema.alterTable("monitor", (table) => {
        table.dropColumn("system_service_name");
    });
};
