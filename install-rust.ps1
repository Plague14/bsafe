$tempPath = [System.IO.Path]::GetTempPath()
$rustupPath = Join-Path $tempPath 'rustup-init.exe'
Write-Host "Downloading Rustup..."
Invoke-WebRequest -Uri 'https://win.rustup.rs/x86_64' -OutFile $rustupPath
Write-Host "Installing Rust..."
Start-Process -FilePath $rustupPath -ArgumentList '-y' -Wait -NoNewWindow
Write-Host "Rust installation complete!"
