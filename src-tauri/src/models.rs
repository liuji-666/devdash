use crate::crypto::{create_master_key, load_master_key};
use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    /// The master key (MK), decrypted from DPAPI-protected storage on startup.
    /// Never written to disk in plaintext. Protected by the current Windows session.
    pub master_key: [u8; 32],
}

impl AppState {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join("devdash.db");
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        init_schema(&conn).map_err(|e| e.to_string())?;

        // Load or create the machine-bound master key
        let master_key = match load_master_key(&app_data_dir) {
            Ok(Some(key)) => {
                log::info!("Master key loaded from DPAPI-protected storage");
                key
            }
            Ok(None) => {
                log::info!("No master key found — generating new one");
                create_master_key(&app_data_dir)?
            }
            Err(e) => {
                log::warn!("Failed to load master key: {e} — generating new one (old tokens will be unreadable)");
                create_master_key(&app_data_dir)?
            }
        };

        Ok(Self {
            db: Mutex::new(conn),
            master_key,
        })
    }
}

fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;

        CREATE TABLE IF NOT EXISTS sources (
            id          TEXT PRIMARY KEY,
            plugin_id   TEXT NOT NULL,
            type        TEXT NOT NULL,
            label       TEXT NOT NULL,
            config      TEXT NOT NULL DEFAULT '{}',
            poll_ms     INTEGER DEFAULT 300000,
            enabled     INTEGER DEFAULT 1,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS data_items (
            id          TEXT PRIMARY KEY,
            source_id   TEXT NOT NULL,
            kind        TEXT NOT NULL,
            external_id TEXT NOT NULL,
            title       TEXT NOT NULL,
            body        TEXT,
            url         TEXT,
            status      TEXT,
            author      TEXT,
            metadata    TEXT NOT NULL DEFAULT '{}',
            fetched_at  TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
            UNIQUE(source_id, external_id)
        );

        CREATE TABLE IF NOT EXISTS dashboards (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            layout      TEXT NOT NULL DEFAULT '[]',
            is_default  INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS widgets (
            id           TEXT PRIMARY KEY,
            dashboard_id TEXT NOT NULL,
            plugin_id    TEXT NOT NULL,
            widget_type  TEXT NOT NULL,
            source_id    TEXT,
            position     TEXT NOT NULL DEFAULT '{"x":0,"y":0,"w":1,"h":1}',
            config       TEXT NOT NULL DEFAULT '{}',
            created_at   TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "#,
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}