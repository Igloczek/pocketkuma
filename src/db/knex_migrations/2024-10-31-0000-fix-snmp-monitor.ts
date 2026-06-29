export const up = function (knex) {
    return knex("monitor").whereNull("json_path_operator").update("json_path_operator", "==");
};
export const down = function (knex) {
    // changing the json_path_operator back to null for all "==" is not possible anymore
    // we have lost the context which fields have been set explicitely in >= v2.0 and which would need to be reverted
};
