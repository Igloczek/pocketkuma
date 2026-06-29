export const up = function (knex) {
    // Add new column heartbeat.retries
    return knex.schema.alterTable("heartbeat", function (table) {
        table.integer("retries").notNullable().defaultTo(0);
    });
};

export const down = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.dropColumn("retries");
    });
};
