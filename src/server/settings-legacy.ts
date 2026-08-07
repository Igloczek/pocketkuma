import { R } from "@/server/sqlite-core";
import { Settings as SettingsStore } from "@/server/settings";

export const legacySettings = new SettingsStore(R);
export const Settings = legacySettings;
