@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

set TMP=Z:\HD_1\temp
set TEMP=Z:\HD_1\temp
set TMPDIR=Z:\HD_1\temp
set CARGO_TARGET_DIR=Z:\HD_1\DFK\BSafe\bsafe-clean\bsafe-clean\anchor\target
set PATH=Z:\HD_1\DFK\BSafe\solana-install\solana-release\bin;Z:\AppData-Backup\.cargo\bin;%PATH%

cd /d Z:\HD_1\DFK\BSafe\bsafe-clean\bsafe-clean\anchor
anchor build
