param(
  [int]$Port = 4180,
  [string]$HostName = "127.0.0.1",
  [switch]$NoStart,
  [switch]$ForceAnyProcess
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Stop-PortListener {
  param([int]$TargetPort)

  foreach ($processId in Get-PortListenerProcessIds -TargetPort $TargetPort) {
    if (-not $processId) {
      continue
    }

    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $process) {
      continue
    }

    if (-not $ForceAnyProcess -and $process.ProcessName -notin @("node")) {
      Write-Warning "Port $TargetPort is owned by $($process.ProcessName) ($processId); not stopping it without -ForceAnyProcess."
      continue
    }

    Write-Host "Stopping $($process.ProcessName) ($processId) on port $TargetPort..."
    Stop-Process -Id $processId -Force
  }

  for ($attempt = 1; $attempt -le 20; $attempt += 1) {
    if ((Get-PortListenerProcessIds -TargetPort $TargetPort).Count -eq 0) {
      return
    }

    Start-Sleep -Milliseconds 100
  }
}

function Get-PortListenerProcessIds {
  param([int]$TargetPort)

  $lines = & netstat -ano -p tcp
  $processIds = @()

  foreach ($line in $lines) {
    if ($line -notmatch "\sLISTENING\s+(\d+)\s*$") {
      continue
    }
    $processId = [int]$Matches[1]

    if ($line -notmatch "\S+:$TargetPort\s+") {
      continue
    }

    $processIds += $processId
  }

  return $processIds | Select-Object -Unique
}

function Wait-WebStatus {
  param(
    [string]$Url,
    [int]$Attempts = 20
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        $status = $response.Content | ConvertFrom-Json
        if ($status.capabilities -contains "claim-ledger") {
          return
        }
      }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  throw "Truth Harness web server did not become ready at $Url."
}

Stop-PortListener -TargetPort $Port

if ($NoStart) {
  Write-Host "Stopped Node listener on port $Port."
  exit 0
}

$arguments = @("run", "web:serve", "--", "--host", $HostName, "--port", [string]$Port)
Start-Process -WindowStyle Hidden -FilePath "npm.cmd" -ArgumentList $arguments -WorkingDirectory $repoRoot

$statusUrl = "http://${HostName}:${Port}/api/status"
Wait-WebStatus -Url $statusUrl
Write-Host "Truth Harness web ready: http://${HostName}:${Port}/"
