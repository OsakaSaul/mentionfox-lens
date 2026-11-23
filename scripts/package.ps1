# Builds the RELEASE bundle and zips dist/ for the Chrome Web Store.
#   powershell -File scripts/package.ps1      (run from the repo root, or anywhere)
# Output: release/mentionfox-lens-<version>.zip with manifest.json at the archive root.
# The release build never bakes an App Check debug token; this script also blanks the env var and
# scans the finished zip for forbidden strings and source maps before it reports success.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$manifest = Get-Content -Raw -Path (Join-Path $root 'manifest.json') | ConvertFrom-Json
$version = $manifest.version
$pkg = Get-Content -Raw -Path (Join-Path $root 'package.json') | ConvertFrom-Json
if ($pkg.version -ne $version) { throw "package.json version $($pkg.version) differs from manifest.json $version" }

# Release build: no token from the environment, no --dev flag.
$env:APPCHECK_DEBUG_TOKEN = ''
$env:FIREBASE_APPCHECK_DEBUG_TOKEN = ''
& node (Join-Path $root 'scripts/build.mjs')
if ($LASTEXITCODE -ne 0) { throw 'release build failed' }

$dist = Join-Path $root 'dist'
$releaseDir = Join-Path $root 'release'
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$zipPath = Join-Path $releaseDir "mentionfox-lens-$version.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$excluded = '\.map$|^\.env|\.env\.|\.md$|\.log$|\.test\.|^test/'
$distFull = (Resolve-Path $dist).Path.TrimEnd('\')
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $count = 0
  foreach ($f in (Get-ChildItem -Path $dist -Recurse -File | Sort-Object FullName)) {
    $rel = $f.FullName.Substring($distFull.Length + 1).Replace('\', '/')
    if ($rel -match $excluded) { Write-Host "skip $rel"; continue }
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal)
    $count++
  }
} finally { $zip.Dispose() }

# Self-check: manifest at root, no maps, no debug-token path, no debug token from .env.local.
$z = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $names = $z.Entries | ForEach-Object { $_.FullName }
  if ($names -notcontains 'manifest.json') { throw 'manifest.json is not at the zip root' }
  if ($names | Where-Object { $_ -match '\|\.map$' }) { throw 'zip has a backslash name or a .map file' }
  $envFile = Join-Path $root '.env.local'
  $token = $null
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^\s*APPCHECK_DEBUG_TOKEN\s*=' } | Select-Object -First 1
    if ($line) { $token = ($line -replace '^\s*APPCHECK_DEBUG_TOKEN\s*=\s*', '').Trim().Trim('"').Trim("'") }
  }
  foreach ($e in $z.Entries) {
    $sr = New-Object System.IO.StreamReader($e.Open())
    $text = $sr.ReadToEnd(); $sr.Close()
    # The Firebase SDK itself only READS this global (== / != compares); an assignment means our dev path shipped.
    if ($text -match 'FIREBASE_APPCHECK_DEBUG_TOKEN\s*=(?!=)') { throw "dev token assignment found in $($e.FullName)" }
    if ($token -and $text.Contains($token)) { throw "debug token found in $($e.FullName)" }
  }
} finally { $z.Dispose() }
Write-Host "OK $zipPath ($count files, version $version)"
