PRAGMA foreign_keys = OFF;

CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT,
    active BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE monitor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    active BOOLEAN NOT NULL DEFAULT 1,
    user_id INTEGER,
    interval INTEGER NOT NULL DEFAULT 20,
    url TEXT,
    type TEXT,
    hostname TEXT,
    grpc_url TEXT,
    game TEXT,
    json_path_operator TEXT,
    domain_expiry_notification BOOLEAN DEFAULT 1,
    accepted_statuscodes_json TEXT NOT NULL DEFAULT '["200-299"]',
    retry_interval INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE status_page (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT NOT NULL,
    theme TEXT NOT NULL,
    published BOOLEAN NOT NULL DEFAULT 1,
    search_engine_index BOOLEAN NOT NULL DEFAULT 1,
    show_tags BOOLEAN NOT NULL DEFAULT 0,
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    google_analytics_tag_id TEXT,
    autoRefreshInterval INTEGER DEFAULT 300
);

CREATE TABLE notification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    active BOOLEAN NOT NULL DEFAULT 1,
    user_id INTEGER,
    is_default BOOLEAN NOT NULL DEFAULT 0,
    config TEXT
);

CREATE TABLE monitor_notification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    notification_id INTEGER NOT NULL
);

CREATE TABLE setting (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    type TEXT
);

INSERT INTO user (username, password, active) VALUES ('admin', 'hash', 1);

INSERT INTO monitor (name, type, game, json_path_operator, domain_expiry_notification, hostname, accepted_statuscodes_json, user_id)
VALUES ('GameDig TF2', 'gamedig', 'tf2', NULL, 1, 'games.example.invalid', '["200-299"]', 1);

INSERT INTO monitor (name, type, json_path_operator, accepted_statuscodes_json, user_id)
VALUES ('SNMP monitor', 'snmp', NULL, '["200-299"]', 1);

INSERT INTO status_page (slug, title, icon, theme, google_analytics_tag_id, autoRefreshInterval)
VALUES ('default', 'Status', '', 'light', 'G-LEGACY', 120);

INSERT INTO notification (name, active, config)
VALUES ('LINE Notify', 1, '{"type":"line-notify","lineNotifyAccessToken":"token"}');

INSERT INTO notification (name, active, config)
VALUES ('Legacy LINE', 1, '{"lineNotifyAccessToken":"legacy-token"}');

INSERT INTO notification (name, active, config)
VALUES ('Underscore LINE', 1, '{"type":"line_notify"}');

INSERT INTO monitor_notification (monitor_id, notification_id) VALUES (1, 1);
INSERT INTO monitor_notification (monitor_id, notification_id) VALUES (1, 2);
INSERT INTO monitor_notification (monitor_id, notification_id) VALUES (1, 3);

PRAGMA foreign_keys = ON;