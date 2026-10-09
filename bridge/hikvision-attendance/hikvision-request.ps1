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
$credential = New-Object System.Net.NetworkCredential ([string]$config.deviceUsername), ([string]$config.devicePassword)
$uri = "http://$($config.deviceIp):$($config.deviceHttpPort)$Path"
try {
  Add-Type -AssemblyName System.Net.Http
  $handler = New-Object System.Net.Http.HttpClientHandler
  $handler.Credentials = $credential
  $handler.PreAuthenticate = $true
  $handler.UseDefaultCredentials = $false
  $client = New-Object System.Net.Http.HttpClient($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(30)
  $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::new($Method), $uri)
  if ($BodyBase64) {
    $bodyBytes = [Convert]::FromBase64String($BodyBase64)
    $request.Content = New-Object System.Net.Http.ByteArrayContent -ArgumentList @(,$bodyBytes)
    $request.Content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($ContentType)
  }
  $response = $client.SendAsync($request).GetAwaiter().GetResult()
  $responseBytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
  [ordered]@{
    status = [int]$response.StatusCode
    bodyBase64 = [Convert]::ToBase64String($responseBytes)
    headers = @{ "content-type" = [string]$response.Content.Headers.ContentType }
  } | ConvertTo-Json -Compress
} catch {
  throw
} finally {
  if ($request) { $request.Dispose() }
  if ($client) { $client.Dispose() }
  if ($handler) { $handler.Dispose() }
}
