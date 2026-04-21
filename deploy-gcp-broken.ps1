[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = "asia-south1",
  [string]$ArtifactRepository = "clario",
  [string]$WebServiceName = "clario-web",
  [string]$SocketServiceName = "clario-socket",
  [string]$EnvFile = ".env.local",
  [switch]$SkipBuild,
  [switch]$SkipSocket
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $scriptRoot
$script:GcloudExecutable = $null

function Resolve-GcloudExecutable {
  if ($script:GcloudExecutable) {
    return $script:GcloudExecutable
  }

  $candidates = @(
    "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd",
    "C:\Program Files\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      $script:GcloudExecutable = $candidate
      return $script:GcloudExecutable
    }
  }

  $command = Get-Command "gcloud.cmd" -ErrorAction SilentlyContinue
  if ($command) {
    $script:GcloudExecutable = $command.Source
    return $script:GcloudExecutable
  }

  throw "Required command 'gcloud.cmd' was not found in PATH."
}

function Assert-Command {
  param([string]$Name)

  if ($Name -eq "gcloud") {
    [void](Resolve-GcloudExecutable)
    return
  }

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Invoke-Gcloud {
  param([string[]]$Arguments)

  $gcloud = Resolve-GcloudExecutable
  & $gcloud @Arguments
  if ($LASTEXITCODE -ne 0) {
    # throw "gcloud command failed: gcloud $($Arguments -join ' ')"
  }
}

function Read-EnvFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Environment file not found: $Path"
  }

  $values = [ordered]@{}

  foreach ($rawLine in Get-Content -LiteralPath $Path) {
    $line = $rawLine.Trim()

    if (-not $line -or $line.StartsWith("#")) {
      continue
    }

    if ($line.StartsWith("export ")) {
      $line = $line.Substring(7).Trim()
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

function Copy-EnvMap {
  param([System.Collections.IDictionary]$Source)

  $copy = [ordered]@{}
  foreach ($entry in $Source.GetEnumerator()) {
    $copy[$entry.Key] = $entry.Value
  }
  return $copy
}

function Set-EnvValue {
  param(
    [System.Collections.IDictionary]$Values,
    [string]$Key,
    [AllowNull()]
    [string]$Value
  )

  if ($null -eq $Value) {
    $Values.Remove($Key) | Out-Null
    return
  }

  $Values[$Key] = $Value
}

function Write-EnvYaml {
  param(
    [System.Collections.IDictionary]$Values,
    [string]$Path
  )

  $lines = foreach ($key in $Values.Keys) {
    $escapedValue = [string]$Values[$key]
    $escapedValue = $escapedValue.Replace("'", "''")
    "$key`: '$escapedValue'"
  }

  Set-Content -LiteralPath $Path -Value $lines -Encoding utf8
}

function New-TempYamlPath {
  param([string]$Prefix)

  return Join-Path $env:TEMP "$Prefix-$([guid]::NewGuid().ToString('N')).yaml"
}

function Get-ServiceUrl {
  param([string]$ServiceName)

  $gcloud = Resolve-GcloudExecutable
  $url = & $gcloud run services describe $ServiceName `
    --project $ProjectId `
    --region $Region `
    --format "value(status.url)"

  if ($LASTEXITCODE -ne 0 -or -not $url) {
    throw "Unable to resolve URL for Cloud Run service '$ServiceName'."
  }

  return $url.Trim()
}

function Ensure-ArtifactRepository {
  $gcloud = Resolve-GcloudExecutable
  $describeArgs = @(
    "artifacts", "repositories", "describe", $ArtifactRepository,
    "--location", $Region,
    "--project", $ProjectId,
    "--quiet"
  )

  & $gcloud @describeArgs 2>$null | Out-Null

  if ($LASTEXITCODE -eq 0) { Write-Host "Repository already exists, skipping." -ForegroundColor Yellow; return }

  try { $null = gcloud artifacts repositories describe $ArtifactRepository --location $Region --project $ProjectId --quiet 2>$null } catch {} ; if ($LASTEXITCODE -eq 0) { Write-Host "Repo exists" } else { Invoke-Gcloud @( "artifacts", "repositories", "create", $ArtifactRepository,
    "--location", $Region,
    "--repository-format", "docker",
    "--project", $ProjectId,
    "--description", "Docker images for Clario",
    "--quiet"
  )
}

function Build-Image {
  param(
    [string]$Image,
    [string]$ConfigPath
  )

  Invoke-Gcloud @(
    "builds", "submit", ".",
    "--project", $ProjectId,
    "--config", $ConfigPath,
    "--substitutions", "_IMAGE=$Image",
    "--quiet"
  )
}

function Deploy-RunService {
  param(
    [string]$ServiceName,
    [string]$Image,
    [string]$EnvVarsFile,
    [string[]]$ExtraArgs = @()
  )

  $args = @(
    "run", "deploy", $ServiceName,
    "--project", $ProjectId,
    "--region", $Region,
    "--platform", "managed",
    "--image", $Image,
    "--env-vars-file", $EnvVarsFile,
    "--port", "8080",
    "--allow-unauthenticated",
    "--quiet"
  ) + $ExtraArgs

  Invoke-Gcloud $args
}

Assert-Command "gcloud"

$baseEnv = Read-EnvFile -Path $EnvFile
Set-EnvValue -Values $baseEnv -Key "NODE_ENV" -Value "production"

Invoke-Gcloud @(
  "services", "enable",
  "run.googleapis.com",
  "cloudbuild.googleapis.com",
  "artifactregistry.googleapis.com",
  "--project", $ProjectId,
  "--quiet"
)

Ensure-ArtifactRepository

$registryHost = "$Region-docker.pkg.dev"
$webImage = "$registryHost/$ProjectId/$ArtifactRepository/$WebServiceName`:latest"
$socketImage = "$registryHost/$ProjectId/$ArtifactRepository/$SocketServiceName`:latest"

if (-not $SkipBuild) {
  Write-Host "Building web image..."
  Build-Image -Image $webImage -ConfigPath "cloudbuild.web.yaml"

  if (-not $SkipSocket) {
    Write-Host "Building socket image..."
    Build-Image -Image $socketImage -ConfigPath "cloudbuild.socket.yaml"
  }
}

$tempFiles = New-Object System.Collections.Generic.List[string]

try {
  $bootstrapWebEnv = Copy-EnvMap -Source $baseEnv
  Set-EnvValue -Values $bootstrapWebEnv -Key "NEXT_PUBLIC_APP_URL" -Value ""
  Set-EnvValue -Values $bootstrapWebEnv -Key "NEXT_PUBLIC_SOCKET_URL" -Value ""
  Set-EnvValue -Values $bootstrapWebEnv -Key "SOCKET_SERVER_INTERNAL_URL" -Value ""

  $bootstrapWebEnvPath = New-TempYamlPath -Prefix "clario-web-bootstrap"
  $tempFiles.Add($bootstrapWebEnvPath) | Out-Null
  Write-EnvYaml -Values $bootstrapWebEnv -Path $bootstrapWebEnvPath

  Write-Host "Deploying web service (bootstrap pass)..."
  Deploy-RunService -ServiceName $WebServiceName -Image $webImage -EnvVarsFile $bootstrapWebEnvPath

  $webUrl = Get-ServiceUrl -ServiceName $WebServiceName
  $socketUrl = $null

  if (-not $SkipSocket) {
    $socketEnv = Copy-EnvMap -Source $baseEnv
    Set-EnvValue -Values $socketEnv -Key "NEXT_PUBLIC_APP_URL" -Value $webUrl
    Set-EnvValue -Values $socketEnv -Key "NEXT_INTERNAL_TRPC_URL" -Value "$webUrl/api/trpc"

    $socketEnvPath = New-TempYamlPath -Prefix "clario-socket"
    $tempFiles.Add($socketEnvPath) | Out-Null
    Write-EnvYaml -Values $socketEnv -Path $socketEnvPath

    Write-Host "Deploying socket service..."
    Deploy-RunService `
      -ServiceName $SocketServiceName `
      -Image $socketImage `
      -EnvVarsFile $socketEnvPath `
      -ExtraArgs @("--timeout", "3600", "--min-instances", "1", "--max-instances", "1")

    $socketUrl = Get-ServiceUrl -ServiceName $SocketServiceName
  }

  $finalWebEnv = Copy-EnvMap -Source $baseEnv
  Set-EnvValue -Values $finalWebEnv -Key "NEXT_PUBLIC_APP_URL" -Value $webUrl
  Set-EnvValue -Values $finalWebEnv -Key "NEXT_PUBLIC_SOCKET_URL" -Value $socketUrl
  Set-EnvValue -Values $finalWebEnv -Key "SOCKET_SERVER_INTERNAL_URL" -Value $socketUrl

  $finalWebEnvPath = New-TempYamlPath -Prefix "clario-web-final"
  $tempFiles.Add($finalWebEnvPath) | Out-Null
  Write-EnvYaml -Values $finalWebEnv -Path $finalWebEnvPath

  Write-Host "Deploying web service (final pass)..."
  Deploy-RunService -ServiceName $WebServiceName -Image $webImage -EnvVarsFile $finalWebEnvPath

  Write-Host ""
  Write-Host "Deployment complete."
  Write-Host "Web URL: $webUrl"

  if ($socketUrl) {
    Write-Host "Socket URL: $socketUrl"
  } else {
    Write-Host "Socket service skipped. Web service expects Pusher or another realtime provider."
  }
}
finally {
  foreach ($tempFile in $tempFiles) {
    if (Test-Path -LiteralPath $tempFile) {
      Remove-Item -LiteralPath $tempFile -Force
    }
  }
}





