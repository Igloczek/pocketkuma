import { log } from "@/util";
import { createServer } from "net";
import { Aedes } from "aedes";

const mqttUsername = "louis1";
const mqttPassword = "!@#$LLam";
const port = 10000;

const main = async () => {
    const aedes = await Aedes.createBroker();
    const server = createServer(aedes.handle);

    aedes.authenticate = function (client, username, password, callback) {
        if (username && password) {
            console.log(password.toString("utf-8"));
            callback(null, username === mqttUsername && password.toString("utf-8") === mqttPassword);
        } else {
            callback(null, false);
        }
    };

    aedes.on("subscribe", (subscriptions, _client) => {
        console.log(subscriptions);

        for (let s of subscriptions) {
            if (s.topic === "test") {
                aedes.publish(
                    {
                        topic: "test",
                        payload: Buffer.from("ok"),
                    },
                    (error) => {
                        if (error) {
                            log.error("mqtt_server", error);
                        }
                    }
                );
            }
        }
    });

    server.listen(port, () => {
        console.log("server started and listening on port ", port);
    });
};

main();
