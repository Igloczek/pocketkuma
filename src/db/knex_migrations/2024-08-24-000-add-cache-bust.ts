export const up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.boolean("cache_bust").notNullable().defaultTo(false);
    });
};

export const down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("cache_bust");
    });
};
