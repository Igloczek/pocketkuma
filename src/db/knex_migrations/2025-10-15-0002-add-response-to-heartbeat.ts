export const up = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.text("response").nullable().defaultTo(null);
    });
};

export const down = function (knex) {
    return knex.schema.alterTable("heartbeat", function (table) {
        table.dropColumn("response");
    });
};
