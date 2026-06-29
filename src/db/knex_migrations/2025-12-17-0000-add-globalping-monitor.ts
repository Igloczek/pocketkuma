export const up = function (knex) {
    // Add new columns
    return knex.schema.alterTable("monitor", function (table) {
        table.string("subtype", 10).nullable();
        table.string("location", 255).nullable();
        table.string("protocol", 20).nullable();
    });
};

export const down = function (knex) {
    // Drop columns
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("subtype");
        table.dropColumn("location");
        table.dropColumn("protocol");
    });
};
