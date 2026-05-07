import sqlite3, json

db = r"C:\Users\刘吉\AppData\Roaming\com.devdash.devdash\devdash.db"
conn = sqlite3.connect(db)
cur = conn.cursor()
cur.execute("SELECT id, type, config FROM sources WHERE type='github' LIMIT 1")
row = cur.fetchone()
if row:
    print("ID:", row[0])
    print("Type:", row[1])
    print("Raw config:", row[2])
    print()
    cfg = json.loads(row[2])
    print("Parsed:", json.dumps(cfg, indent=2))
    print()
    print("allRepos in config:", "allRepos" in cfg)
    print("all_repos in config:", "all_repos" in cfg)
    print("allRepos value:", cfg.get("allRepos"))
conn.close()
