import { R } from "@/server/bun-sqlite-store";
import { Settings as SettingsStore } from "@/server/settings";

export const legacySettings = new SettingsStore(R);
export const Settings = legacySettings;
