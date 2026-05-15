$connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

foreach ($connection in $connections) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
  if ($process -and ($process.CommandLine -like '*CloudCut*backend*' -or $process.CommandLine -like '*@nestjs*cli*')) {
    Write-Host "Stopping backend process $($connection.OwningProcess) on port 3000"
    Stop-Process -Id $connection.OwningProcess -Force
  }
}
