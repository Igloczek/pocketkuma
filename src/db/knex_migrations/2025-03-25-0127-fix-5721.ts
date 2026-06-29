// Fix #5721: Change proxy port column type to integer to support larger port numbers
export const up = function (knex) {
    return knex.schema.alterTable("proxy", function (table) {
        table.integer("port").alter();
    });
};

export const down = function (knex) {
    return knex.schema.alterTable("proxy", function (table) {
        table.smallint("port").alter();
    });
};
