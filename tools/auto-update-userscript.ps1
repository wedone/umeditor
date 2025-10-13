<#
Auto-update helper for Tampermonkey userscript during development.

Behavior:
- Optionally bump the @version in the userscript to a timestamp.
- Start a local static HTTP server (Python) serving the repository root on port 8000.
- Open the userscript URL in the default browser to trigger Tampermonkey's update/install flow.

Usage (PowerShell):
    # from repo root (d:\VC\umeditor)
    .\tools\auto-update-userscript.ps1 -BumpVersion -Port 8000 -ScriptPath scripts/um-inject.user.js

Notes:
- Tampermonkey compares @version and/or the @updateURL contents to decide whether to update.
- The script uses Python's http.server. Ensure Python is on PATH.
- If you already run a server on the requested port, specify a different port.
#>
param(
    [switch] $BumpVersion,
    [int] $Port = 8000,
    [string] $ScriptPath = "scripts/um-inject.user.js",
    [switch] $OpenBrowser = $true
)

function TimestampVersion() {
    $now = Get-Date -Format "yyyy.MM.dd.HHmmss"
    return $now
}

# repo root assumed to be script's parent of parent
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $repoRoot

$absScript = Resolve-Path $ScriptPath
if (-not (Test-Path $absScript)) { Write-Error "Userscript not found: $ScriptPath"; exit 2 }

if ($BumpVersion) {
    $ts = TimestampVersion
    $text = Get-Content -Raw -Path $absScript
    # replace @version line
    $new = $text -replace "(?m)^//\s*@version\s+.*$", "// @version      $ts"
    Set-Content -Path $absScript -Value $new -Encoding UTF8
    Write-Host "Bumped version to $ts in $ScriptPath"
}

# Start simple HTTP server using python -m http.server
$serverCmd = "python -m http.server $Port"
Write-Host "Starting local HTTP server at http://127.0.0.1:$Port/ (serving $repoRoot)"
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = "cmd.exe"
$startInfo.Arguments = "/c $serverCmd"
$startInfo.WorkingDirectory = $repoRoot
$startInfo.CreateNoWindow = $true
$startInfo.UseShellExecute = $false
$proc = [System.Diagnostics.Process]::Start($startInfo)
Start-Sleep -Milliseconds 800

# open the userscript URL to trigger Tampermonkey
$scriptUrl = "http://127.0.0.1:$Port/$ScriptPath"
if ($OpenBrowser) {
    Write-Host "Opening $scriptUrl"
    Start-Process $scriptUrl
}

Write-Host "Server PID: $($proc.Id). Press Ctrl-C to stop the script (server keeps running)."

# Wait to keep the PowerShell session alive so the server/process remains running
try {
    while ($true) { Start-Sleep -Seconds 3600 }
} finally {
    if (!$proc.HasExited) { $proc.Kill() }
}
