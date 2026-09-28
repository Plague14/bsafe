Write-Host "Installing Solana CLI..."
$env:Path = "Z:\AppData-Backup\.cargo\bin;" + $env:Path

# Download and run Solana installer
$solanaInstaller = "$env:TEMP\solana-install-init.exe"
Invoke-WebRequest -Uri "https://release.solana.com/v1.18.26/solana-install-init-x86_64-pc-windows-msvc.exe" -OutFile $solanaInstaller
Start-Process -FilePath $solanaInstaller -ArgumentList "v1.18.26" -Wait -NoNewWindow

Write-Host "Solana CLI installation complete!"
