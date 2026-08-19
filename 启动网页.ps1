$ErrorActionPreference = 'Stop'

$nodePath = 'C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$vitePath = Join-Path $PSScriptRoot 'node_modules\vite\bin\vite.js'
$url = 'http://localhost:5174/'

if (-not (Test-Path -LiteralPath $nodePath)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('Codex bundled Node.js was not found. Reinstall the project dependencies in Codex.', 'Synthetic Data Studio') | Out-Null
    exit 1
}

if (-not (Test-Path -LiteralPath $vitePath)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('Project dependencies are missing. Install them in Codex first.', 'Synthetic Data Studio') | Out-Null
    exit 1
}

$listener = Get-NetTCPConnection -LocalPort 5174 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    $stdoutPath = Join-Path $PSScriptRoot 'server.out.log'
    $stderrPath = Join-Path $PSScriptRoot 'server.err.log'
    Start-Process -FilePath $nodePath `
        -ArgumentList @($vitePath, '--host', '127.0.0.1', '--port', '5174') `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath
    Start-Sleep -Seconds 2
}

Start-Process $url
