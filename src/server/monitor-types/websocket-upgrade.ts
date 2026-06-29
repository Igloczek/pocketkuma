// @ts-nocheck

// Define closing error codes https://www.iana.org/assignments/websocket/websocket.xml#close-code-number
import { MonitorType } from "@/server/monitor-types/monitor-type";
import { UP } from "@/util";
import { checkStatusCode, getOidcTokenClientCredentials } from "@/server/util-server";

const WS_ERR_CODE = {
    1002: "Protocol error",
    1003: "Unsupported Data",
    1005: "No Status Received",
    1006: "Abnormal Closure",
    1007: "Invalid frame payload data",
    1008: "Policy Violation",
    1009: "Message Too Big",
    1010: "Mandatory Extension Missing",
    1011: "Internal Error",
    1012: "Service Restart",
    1013: "Try Again Later",
    1014: "Bad Gateway",
    1015: "TLS Handshake Failed",
    3000: "Unauthorized",
    3003: "Forbidden",
    3008: "Timeout",
};

class WebSocketMonitorType extends MonitorType {
    name = "websocket-upgrade";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const [message, code] = await this.attemptUpgrade(monitor);

        if (typeof code !== "undefined") {
            // If returned status code matches user controlled accepted status code(default 1000), return success
            if (checkStatusCode(code, JSON.parse(monitor.accepted_statuscodes_json))) {
                heartbeat.status = UP;
                heartbeat.msg = message;
                return; // success at this point
            }

            // Throw an error using friendly name if defined, fallback to generic msg
            throw new Error(WS_ERR_CODE[code] || `Unexpected status code: ${code}`);
        }
        // If no close code, then an error has occurred, display to user
        if (typeof message !== "undefined") {
            throw new Error(`${message}`);
        }
        // Throw generic error if nothing is defined, should never happen
        throw new Error("Unknown Websocket Error");
    }

    /**
     * Builds the WebSocket options object for authentication and TLS.
     * Supports basic auth, bearer token, and OAuth2 client credentials.
     * mTLS is explicitly unsupported on the Bun WebSocket client.
     * @param {object} monitor The monitor object for input parameters.
     * @returns {Promise<object>} The options object to pass to the WebSocket constructor.
     */
    async buildWsOptions(monitor) {
        const options = {};

        const timeoutMs = (monitor.timeout ?? 20) * 1000;
        options.handshakeTimeout = timeoutMs;

        // Parse custom headers if provided
        if (monitor.headers) {
            try {
                options.headers = JSON.parse(monitor.headers);
            } catch (e) {
                // If headers is not valid JSON, ignore it
                options.headers = {};
            }
        } else {
            options.headers = {};
        }

        if (monitor.authMethod === "basic") {
            if (monitor.basic_auth_user || monitor.basic_auth_pass) {
                const credentials = Buffer.from(
                    `${monitor.basic_auth_user ?? ""}:${monitor.basic_auth_pass ?? ""}`
                ).toString("base64");
                options.headers.Authorization = `Basic ${credentials}`;
            }
        } else if (monitor.authMethod === "bearer") {
            if (monitor.bearer_token) {
                options.headers.Authorization = `Bearer ${monitor.bearer_token}`;
            }
        } else if (monitor.authMethod === "oauth2-cc") {
            if (new Date((monitor.oauthAccessToken?.expires_at || 0) * 1000) <= new Date()) {
                monitor.oauthAccessToken = await getOidcTokenClientCredentials(
                    monitor.oauth_token_url,
                    monitor.oauth_client_id,
                    monitor.oauth_client_secret,
                    monitor.oauth_scopes,
                    monitor.oauth_audience,
                    monitor.oauth_auth_method
                );
            }
            options.headers.Authorization = `${monitor.oauthAccessToken.token_type} ${monitor.oauthAccessToken.access_token}`;
        } else if (monitor.authMethod === "mtls") {
            throw new Error("mTLS WebSocket authentication is not supported by the Bun WebSocket client");
        }

        return options;
    }

    /**
     * Uses the Bun WebSocket client to establish a connection to target server
     * @param {object} monitor The monitor object for input parameters.
     * @returns {Promise<[ string, int ]>} Array containing a status message and response code
     */
    async attemptUpgrade(monitor) {
        const authOptions = await this.buildWsOptions(monitor);

        return new Promise((resolve) => {
            const subprotocol = monitor.wsSubprotocol ? monitor.wsSubprotocol.replace(/\s/g, "").split(",") : undefined;
            let settled = false;
            let ws;

            const finish = (message, code) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeoutId);
                try {
                    ws?.close();
                } catch (_) {}
                resolve([message, code]);
            };

            const timeoutId = setTimeout(() => {
                finish("Timeout", 3008);
            }, authOptions.handshakeTimeout || 20_000);

            try {
                ws = new WebSocket(monitor.url, subprotocol, authOptions);
            } catch (error) {
                finish(error.message, error.code);
                return;
            }

            ws.addEventListener("open", () => {
                ws.close(1000);
            });

            ws.addEventListener("error", (event) => {
                const error = event.error || event;
                const message = error?.message;
                if (
                    monitor.wsIgnoreSecWebsocketAcceptHeader &&
                    (message === "Invalid Sec-WebSocket-Accept header" ||
                        /missing websocket accept header/i.test(message))
                ) {
                    finish("1000 - OK", 1000);
                    return;
                }
                finish(message || "WebSocket error", error?.code);
            });

            ws.addEventListener("close", (event) => {
                finish(event.wasClean ? event.code.toString() + " - OK" : event.reason, event.code);
            });
        });
    }
}

export { WebSocketMonitorType };
