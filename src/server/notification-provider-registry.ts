// @ts-nocheck

import {
    getNotificationProviderModuleMap,
    NOTIFICATION_PROVIDER_REGISTRY,
} from "@/notification-provider-metadata";

const providerModules = getNotificationProviderModuleMap();

const OPTIONAL_NOTIFICATION_PROVIDERS = Object.keys(providerModules);
const loadedProviders = {};
const loadingProviders = {};

function createProviderList() {
    return Object.fromEntries(OPTIONAL_NOTIFICATION_PROVIDERS.map((name) => [name, { name }]));
}

async function getNotificationProvider(name) {
    const moduleName = providerModules[name];
    if (!moduleName) {
        return null;
    }

    if (loadedProviders[name]) {
        return loadedProviders[name];
    }

    if (!loadingProviders[name]) {
        loadingProviders[name] = (async () => {
            try {
                const module = await import(`./notification-providers/${moduleName}.ts`);
                const provider = new module.default();
                loadedProviders[name] = provider;
                return provider;
            } finally {
                if (!loadedProviders[name]) {
                    delete loadingProviders[name];
                }
            }
        })();
    }

    return await loadingProviders[name];
}

function getLoadedNotificationProviders() {
    return Object.keys(loadedProviders);
}

function resetLoadedNotificationProvidersForTests() {
    for (const key of Object.keys(loadedProviders)) {
        delete loadedProviders[key];
    }
    for (const key of Object.keys(loadingProviders)) {
        delete loadingProviders[key];
    }
}

export {
    NOTIFICATION_PROVIDER_REGISTRY,
    OPTIONAL_NOTIFICATION_PROVIDERS,
    createProviderList,
    getLoadedNotificationProviders,
    getNotificationProvider,
    resetLoadedNotificationProvidersForTests,
};