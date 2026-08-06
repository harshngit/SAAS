$ports = @(5173, 5174, 4173)
$stopped = @()

foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

  foreach ($connection in $connections) {
    $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue

    if ($process -and $process.ProcessName -eq 'node') {
      Stop-Process -Id $process.Id -Force
      $stopped += "Stopped node process $($process.Id) on port $port"
    }
  }
}

if ($stopped.Count -eq 0) {
  Write-Host 'No Vite/Node dev server was listening on ports 5173, 5174, or 4173.'
} else {
  $stopped | ForEach-Object { Write-Host $_ }
}
