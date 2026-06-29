// @ts-nocheck

/**
 * Minimal event emitter compatible with mitt.
 * @returns {object} Event emitter with on/off/emit.
 */
function createEventEmitter() {
    const listeners = new Map();

    return {
        on(type, handler) {
            const handlers = listeners.get(type);
            if (handlers) {
                handlers.push(handler);
            } else {
                listeners.set(type, [handler]);
            }
        },
        off(type, handler) {
            const handlers = listeners.get(type);
            if (!handlers) {
                return;
            }
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        },
        emit(type, event) {
            const handlers = listeners.get(type);
            if (!handlers) {
                return;
            }
            for (const handler of [...handlers]) {
                handler(event);
            }
        },
    };
}

export { createEventEmitter };
