export const up = function (knex) {
    // Add new column monitor.mqtt_check_type
    return knex.schema.alterTable("monitor", function (table) {
        table.string("mqtt_check_type", 255).notNullable().defaultTo("keyword");
    });
};

export const down = function (knex) {
    // Drop column monitor.mqtt_check_type
    return knex.schema.alterTable("monitor", function (table) {
        table.dropColumn("mqtt_check_type");
    });
};
