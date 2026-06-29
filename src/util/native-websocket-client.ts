// @ts-nocheck
class NativeWebSocketClient {
    constructor(url) {
        this.baseURL = url;
        this.handlers = new Map();
        this.callbacks = new Map();
        this.queue = [];
        this.nextID = 1;
        this.manuallyClosed = false;
        this.reconnectTimer = null;
        this.connectionAttempt = 0;
        this.connect();
    }

    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event).add(handler);
    }

    emit(event, ...args) {
        let callback;
        if (typeof args[args.length - 1] === "function") {
            callback = args.pop();
        }

        const message = {
            type: "event",
            event,
            args,
        };

        if (callback) {
            message.id = String(this.nextID++);
            this.callbacks.set(message.id, callback);
        }

        this.send(message);
    }

    disconnect() {
        this.manuallyClosed = true;
        if (this.ws) {
            this.ws.close();
        }
    }

    connect() {
        const wsURL = this.resolveWebSocketURL();
        const attempt = ++this.connectionAttempt;
        const ws = new WebSocket(wsURL);
        this.ws = ws;

        ws.addEventListener("open", () => {
            if (attempt !== this.connectionAttempt) {
                return;
            }
            this.dispatch("connect");
            for (const message of this.queue.splice(0)) {
                this.send(message);
            }
        });

        ws.addEventListener("message", (event) => {
            if (attempt !== this.connectionAttempt) {
                return;
            }
            this.handleMessage(event.data);
        });

        ws.addEventListener("error", (event) => {
            if (attempt !== this.connectionAttempt) {
                return;
            }
            this.dispatch("connect_error", event);
        });

        ws.addEventListener("close", () => {
            if (attempt !== this.connectionAttempt) {
                return;
            }
            this.dispatch("disconnect");
            if (!this.manuallyClosed) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = setTimeout(() => this.connect(), 2000);
            }
        });
    }

    resolveWebSocketURL() {
        const base = this.baseURL ? new URL(this.baseURL, window.location.href) : new URL(window.location.href);
        base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
        base.pathname = "/ws";
        base.search = "";
        base.hash = "";
        return base.toString();
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.queue.push(message);
        }
    }

    handleMessage(raw) {
        let message;
        try {
            message = JSON.parse(raw);
        } catch (error) {
            console.error("Invalid WebSocket message", error);
            return;
        }

        if (message.type === "event") {
            this.dispatch(message.event, ...(message.args || []));
        } else if (message.type === "reply" && message.id) {
            const callback = this.callbacks.get(message.id);
            if (callback) {
                this.callbacks.delete(message.id);
                callback(...(message.args || []));
            }
        } else if (message.type === "error") {
            const callback = message.id ? this.callbacks.get(message.id) : null;
            if (callback) {
                this.callbacks.delete(message.id);
                callback({
                    ok: false,
                    msg: message.message,
                });
            } else {
                console.error("WebSocket protocol error", message.message);
            }
        }
    }

    dispatch(event, ...args) {
        const handlers = this.handlers.get(event);
        if (!handlers) {
            return;
        }

        for (const handler of handlers) {
            handler(...args);
        }
    }
}

export function createNativeWebSocket(url) {
    return new NativeWebSocketClient(url);
}
