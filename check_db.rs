use rusqlite::{Connection, Result};

fn main() -> Result<()> {
    let db_path = r"C:\Users\刘吉\AppData\Roaming\com.devdash.app\devdash.db";
    let conn = Connection::open(db_path)?;
    
    println!("=== SOURCES ===");
    let mut stmt = conn.prepare("SELECT id, type, enabled, config FROM sources")?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i64>(2)?,
            r.get::<_, String>(3)?,
        ))
    })?;
    
    for row in rows {
        let (id, stype, enabled, config) = row?;
        println!("ID: {} | Type: {} | Enabled: {}", &id[..8.min(id.len())], stype, enabled);
        println!("Config: {}...", &config[..config.len().min(100)]);
        println!();
    }
    
    println!("\n=== WIDGETS ===");
    let mut stmt2 = conn.prepare("SELECT id, widget_type, source_id FROM widgets")?;
    let wrows = stmt2.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, Option<String>>(2)?,
        ))
    })?;
    
    for row in wrows {
        let (id, wtype, sid) = row?;
        println!("ID: {} | Type: {} | Source: {:?}", &id[..8.min(id.len())], wtype, sid.as_deref().unwrap_or("NULL"));
    }
    
    println!("\n=== DATA ITEMS COUNT ===");
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM data_items", [], |r| r.get(0))?;
    println!("Total data_items: {}", count);
    
    if count > 0 {
        println!("\n=== DATA ITEMS BY KIND ===");
        let mut stmt3 = conn.prepare("SELECT kind, COUNT(*) FROM data_items GROUP BY kind")?;
        let kinds = stmt3.query_map([], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
        })?;
        for k in kinds {
            let (kind, cnt) = k?;
            println!("  {}: {}", kind, cnt);
        }
        
        println!("\n=== LATEST DATA ITEMS ===");
        let mut stmt4 = conn.prepare("SELECT kind, title, status, fetched_at FROM data_items ORDER BY fetched_at DESC LIMIT 5")?;
        let items = stmt4.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, String>(3)?,
            ))
        })?;
        for item in items {
            let (kind, title, status, fetched_at) = item?;
            println!("  [{}] {} (status={:?}, fetched={})", kind, &title[..title.len().min(50)], status, fetched_at);
        }
    }
    
    Ok(())
}
