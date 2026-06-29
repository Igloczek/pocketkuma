export const up = function (knex) {
    // update monitor.push_token to 32 length
    return knex.schema.alterTable("monitor", function (table) {
        table.string("push_token", 32).alter();
    });
};

export const down = function (knex) {
    return knex.schema.alterTable("monitor", function (table) {
        table.string("push_token", 20).alter();
    });
};
