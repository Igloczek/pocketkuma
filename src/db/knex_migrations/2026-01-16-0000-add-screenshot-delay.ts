export const up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.integer("screenshot_delay").notNullable().unsigned().defaultTo(0);
    });
};

export const down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("screenshot_delay");
    });
};
