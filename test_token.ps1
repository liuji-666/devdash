# Test GitHub API token directly via PowerShell
# Read encrypted token from correct DB, decrypt via .NET, test API

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

$dbPath = "C:\Users\刘吉\AppData\Roaming\com.devdash.devdash\devdash.db"

# Read the config from the correct DB
$conn = New-Object System.Data.SQLite.SQLiteConnection("Data Source=$dbPath;Version=3;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT id, config FROM sources WHERE type = 'github' AND enabled = 1 LIMIT 1"
$reader = $cmd.ExecuteReader()
if ($reader.Read()) {
    $id = $reader.GetString(0)
    $configJson = $reader.GetString(1)
    Write-Host "[DB] Source ID: $id"
    Write-Host "[DB] Config: $configJson"
    
    $config = $configJson | ConvertFrom-Json
    $token = $config.token
    Write-Host "[DB] Token length: $($token.Length)"
    Write-Host "[DB] Token prefix: $($token.Substring(0, [Math]::Min(10, $token.Length)))"
    
    # Try to decode as base64
    try {
        $decodedBytes = [Convert]::FromBase64String($token)
        Write-Host "[BASE64] Decoded length: $($decodedBytes.Length)"
        if ($decodedBytes.Length -ge 28) {
            $salt = $decodedBytes[0..15]
            $nonce = $decodedBytes[16..27]
            $ciphertext = $decodedBytes[28..($decodedBytes.Length - 1)]
            Write-Host "[STRUCT] salt=16, nonce=12, ciphertext=$($ciphertext.Length)"
            Write-Host "[STRUCT] Salt (hex): $([BitConverter]::ToString($salt) -replace '-')"
            Write-Host "[STRUCT] Nonce (hex): $([BitConverter]::ToString($nonce) -replace '-')"
        }
    } catch {
        Write-Host "[BASE64] Decode failed: $_"
    }
}
$reader.Close()
$conn.Close()
