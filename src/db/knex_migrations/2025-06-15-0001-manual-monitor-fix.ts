// Fix: Change manual_status column type to smallint
export const up = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.smallint("manual_status").alter();
    });
};

export const down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("manual_status").alter();
    });
};
