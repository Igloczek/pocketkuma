// @ts-nocheck
"use strict";

/**
 * Legacy RedBean-compatible facade. New code should import sqlite-core when it
 * deliberately needs a lightweight store without domain model loading.
 */
import { R, BeanModel, BunSQLiteRedbean, registerModel } from "@/server/sqlite-core";
import "@/server/model-registry";

export { R, BeanModel, BunSQLiteRedbean, registerModel };
