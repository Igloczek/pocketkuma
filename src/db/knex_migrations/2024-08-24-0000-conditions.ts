export const up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.text("conditions").notNullable().defaultTo("[]");
    });
};

export const down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("conditions");
    });
};
