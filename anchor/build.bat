@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

rem Windows SDK (NuGet packages extracted on Z:, not installed on C:)
set WINSDK=Z:\HD_1\DFK\BSafe\winsdk
set WINSDK_VER=10.0.22621.0
set LIB=%WINSDK%\lib\c\um\x64;%WINSDK%\lib\c\ucrt\x64;%LIB%
set INCLUDE=%WINSDK%\sdk\c\Include\%WINSDK_VER%\um;%WINSDK%\sdk\c\Include\%WINSDK_VER%\ucrt;%WINSDK%\sdk\c\Include\%WINSDK_VER%\shared;%INCLUDE%

set TMP=Z:\HD_1\temp
set TEMP=Z:\HD_1\temp
set TMPDIR=Z:\HD_1\temp
set CARGO_TARGET_DIR=Z:\HD_1\DFK\BSafe\bsafe-clean\bsafe-clean\anchor\target
set PATH=Z:\HD_1\DFK\BSafe\solana-install\solana-release\bin;Z:\HD_1\DFK\BSafe\mingw64\bin;Z:\AppData-Backup\.cargo\bin;%PATH%

cd /d Z:\HD_1\DFK\BSafe\bsafe-clean\bsafe-clean\anchor
rem Anchor 0.30.1's IDL step is broken on current Rust; build the .so here and
rem generate the IDL with scripts\build-idl.py instead.
anchor build --no-idl || exit /b 1
python scripts\build-idl.py || exit /b 1
