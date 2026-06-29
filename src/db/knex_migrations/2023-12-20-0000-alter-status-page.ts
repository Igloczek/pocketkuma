export const up = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.integer("auto_refresh_interval").defaultTo(300).unsigned();
    });
};

export const down = function (knex) {
    return knex.schema.alterTable("status_page", function (table) {
        table.dropColumn("auto_refresh_interval");
    });
};
