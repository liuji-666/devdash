# PowerShell script to check DevDash database state

$dbPath = "C:\Users\刘吉\AppData\Roaming\com.devdash.app\devdash.db"

Write-Host "=== Checking DevDash Database ===" -ForegroundColor Cyan
Write-Host "Database path: $dbPath" -ForegroundColor Gray

if (-not (Test-Path $dbPath)) {
    Write-Host "ERROR: Database not found!" -ForegroundColor Red
    exit 1
}

# Check file size
$size = (Get-Item $dbPath).Length
Write-Host "Database size: $size bytes" -ForegroundColor Gray

# Use .NET to read SQLite (since sqlite3 is not installed)
Add-Type -Path "C:\Users\刘吉\.qclaw\workspace\devdash\src-tauri\target\release\deps\rusqlite-*.dll" -ErrorAction SilentlyContinue

if (-not $?) {
    Write-Host "Cannot load rusqlite DLL, using file analysis..." -ForegroundColor Yellow
    
    # Check if database is valid SQLite
    $bytes = [System.IO.File]::ReadAllBytes($dbPath)
    $header = [System.Text.Encoding]::ASCII.GetString($bytes[0..15])
    Write-Host "SQLite header: $header" -ForegroundColor Gray
    
    # Check for table names in raw bytes
    $content = [System.Text.Encoding]::UTF8.GetString($bytes)
    
    Write-Host "`n=== Tables found in raw data ===" -ForegroundColor Cyan
    if ($content -match "CREATE TABLE sources") { Write-Host "  ✓ sources table exists" -ForegroundColor Green }
    if ($content -match "CREATE TABLE data_items") { Write-Host "  ✓ data_items table exists" -ForegroundColor Green }
    if ($content -match "CREATE TABLE widgets") { Write-Host "  ✓ widgets table exists" -ForegroundColor Green }
    if ($content -match "CREATE TABLE dashboards") { Write-Host "  ✓ dashboards table exists" -ForegroundColor Green }
    
    # Count occurrences of source IDs
    Write-Host "`n=== Searching for source records ===" -ForegroundColor Cyan
    $sourceMatches = [regex]::Matches($content, '"id"\s*:\s*"([^"]{8}-[^"]{4}-[^"]{4}-[^"]{4}-[^"]{12})"')
    $uniqueIds = @{}
    foreach ($match in $sourceMatches) {
        $id = $match.Groups[1].Value
        if (-not $uniqueIds.ContainsKey($id)) {
            $uniqueIds[$id] = 0
        }
        $uniqueIds[$id]++
    }
    
    Write-Host "Found $($uniqueIds.Count) unique UUIDs" -ForegroundColor Gray
    foreach ($id in $uniqueIds.Keys | Select-Object -First 5) {
        Write-Host "  $id (appears $($uniqueIds[$id]) times)" -ForegroundColor Gray
    }
    
    # Check for GitHub token patterns
    Write-Host "`n=== Checking for tokens ===" -ForegroundColor Cyan
    if ($content -match 'ghp_[a-zA-Z0-9]{36}') {
        Write-Host "  ✓ Found plaintext GitHub token (ghp_...)" -ForegroundColor Green
    }
    if ($content -match '"token"\s*:\s*"[^"]{50,}"') {
        Write-Host "  ✓ Found encrypted token (base64, >50 chars)" -ForegroundColor Green
    }
    if ($content -match '"token"\s*:\s*""') {
        Write-Host "  ✗ Found empty token" -ForegroundColor Red
    }
    
    # Check for data items
    Write-Host "`n=== Data presence ===" -ForegroundColor Cyan
    $prCount = ([regex]::Matches($content, '"kind"\s*:\s*"pull_request"')).Count
    $issueCount = ([regex]::Matches($content, '"kind"\s*:\s*"issue"')).Count
    $ciCount = ([regex]::Matches($content, '"kind"\s*:\s*"ci_run"')).Count
    
    Write-Host "  PR items: $prCount" -ForegroundColor $(if ($prCount -gt 0) { "Green" } else { "Red" })
    Write-Host "  Issue items: $issueCount" -ForegroundColor $(if ($issueCount -gt 0) { "Green" } else { "Red" })
    Write-Host "  CI items: $ciCount" -ForegroundColor $(if ($ciCount -gt 0) { "Green" } else { "Red" })
}

Write-Host "`n=== Recommendations ===" -ForegroundColor Cyan
if ($prCount -eq 0 -and $issueCount -eq 0 -and $ciCount -eq 0) {
    Write-Host "  ✗ No data items found!" -ForegroundColor Red
    Write-Host "  Possible causes:" -ForegroundColor Yellow
    Write-Host "    1. GitHub Token is invalid or expired" -ForegroundColor Yellow
    Write-Host "    2. Token decryption failed (master key changed)" -ForegroundColor Yellow
    Write-Host "    3. No matching PRs/Issues for search criteria" -ForegroundColor Yellow
    Write-Host "  Action: Re-enter GitHub Token in Settings → Data Sources" -ForegroundColor Cyan
} else {
    Write-Host "  ✓ Data exists in database" -ForegroundColor Green
    Write-Host "  If widgets still show empty, check widget source_id matches" -ForegroundColor Yellow
}
