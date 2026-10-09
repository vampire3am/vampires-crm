param(
  [Parameter(Mandatory=$true)][string]$ConfigPath,
  [Parameter(Mandatory=$true)][string]$Method,
  [Parameter(Mandatory=$true)][string]$Path,
  [string]$BodyBase64 = "",
  [string]$ContentType = "application/json"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$securePassword = ConvertTo-SecureString ([string]$config.devicePassword) -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential ([string]$config.deviceUsername, $securePassword)
$uri = "http://$($config.deviceIp):$($config.deviceHttpPort)$Path"
$parameters = @{
  Uri = $uri
  Method = $Method
  Credential = $credential
  UseBasicParsing = $true
  ErrorAction = "Stop"
}
if ($BodyBase64) {
  $parameters.Body = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($BodyBase64))
  $parameters.ContentType = $ContentType
}

try {
  $response = Invoke-WebRequest @parameters
  $bodyBytes = [Text.Encoding]::UTF8.GetBytes([string]$response.Content)
  [ordered]@{
    status = [int]$response.StatusCode
    bodyBase64 = [Convert]::ToBase64String($bodyBytes)
    headers = @{ "content-type" = [string]$response.Headers["Content-Type"] }
  } | ConvertTo-Json -Compress
} catch {
  $status = 0
  $body = ""
  if ($_.Exception.Response) {
    try { $status = [int]$_.Exception.Response.StatusCode } catch {}
    try {
      $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
      $body = $reader.ReadToEnd()
      $reader.Dispose()
    } catch {}
  }
  if ($status -gt 0) {
    [ordered]@{
      status = $status
      bodyBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($body))
      headers = @{}
    } | ConvertTo-Json -Compress
  } else {
    throw
  }
}
