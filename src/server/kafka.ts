// @ts-nocheck

import { log } from "@/util";
import { Kafka, SASLOptions } from "kafkajs";

// SASLOptions used in JSDoc
// eslint-disable-next-line no-unused-vars

/**
 * Monitor Kafka using Producer
 * @param {string[]} brokers List of kafka brokers to connect, host and
 * port joined by ':'
 * @param {string} topic Topic name to produce into
 * @param {string} message Message to produce
 * @param {object} options Kafka client options. Contains ssl, clientId,
 * allowAutoTopicCreation and interval (interval defaults to 20,
 * allowAutoTopicCreation defaults to false, clientId defaults to
 * "Uptime-Kuma" and ssl defaults to false)
 * @param {SASLOptions} saslOptions Options for kafka client
 * Authentication (SASL) (defaults to {})
 * @returns {Promise<string>} Status message
 */
export function kafkaProducerAsync(brokers, topic, message, options = {}, saslOptions = {}) {
    return new Promise((resolve, reject) => {
        const {
            interval = 20,
            allowAutoTopicCreation = false,
            ssl = false,
            clientId = "Uptime-Kuma",
            connectionTimeout = 1,
        } = options;

        let connectedToKafka = false;

        const timeoutID = setTimeout(
            () => {
                log.debug("kafkaProducer", "KafkaProducer timeout triggered");
                connectedToKafka = true;
                reject(new Error("Timeout"));
            },
            interval * 1000 * 0.8
        );

        if (saslOptions.mechanism === "None") {
            saslOptions = undefined;
        }

        let client = new Kafka({
            brokers: brokers,
            clientId: clientId,
            sasl: saslOptions,
            retry: {
                retries: 0,
            },
            ssl: ssl,
            connectionTimeout: connectionTimeout * 1000,
        });

        let producer = client.producer({
            allowAutoTopicCreation: allowAutoTopicCreation,
            retry: {
                retries: 0,
            },
        });

        producer
            .connect()
            .then(() => {
                producer
                    .send({
                        topic: topic,
                        messages: [
                            {
                                value: message,
                            },
                        ],
                    })
                    .then((_) => {
                        resolve("Message sent successfully");
                    })
                    .catch((e) => {
                        connectedToKafka = true;
                        producer.disconnect();
                        clearTimeout(timeoutID);
                        reject(new Error("Error sending message: " + e.message));
                    })
                    .finally(() => {
                        connectedToKafka = true;
                        clearTimeout(timeoutID);
                    });
            })
            .catch((e) => {
                connectedToKafka = true;
                producer.disconnect();
                clearTimeout(timeoutID);
                reject(new Error("Error in producer connection: " + e.message));
            });

        producer.on("producer.network.request_timeout", (_) => {
            if (!connectedToKafka) {
                clearTimeout(timeoutID);
                reject(new Error("producer.network.request_timeout"));
            }
        });

        producer.on("producer.disconnect", (_) => {
            if (!connectedToKafka) {
                clearTimeout(timeoutID);
                reject(new Error("producer.disconnect"));
            }
        });
    });
}