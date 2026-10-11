@echo off
rem Runs the LiteSVM end-to-end tests against the compiled program.
rem Usage: run-tests.bat            (production timers, needs a build without demo-timers)
rem        run-tests.bat demo       (devnet build: anchor\build.bat -- --features demo-timers)
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul

rem Windows SDK and mingw (dlltool) live on Z:, see anchor\build.bat
set WINSDK=Z:\HD_1\DFK\BSafe\winsdk
set LIB=%WINSDK%\lib\c\um\x64;%WINSDK%\lib\c\ucrt\x64;%LIB%
set PATH=Z:\HD_1\DFK\BSafe\mingw64\bin;Z:\AppData-Backup\.cargo\bin;%PATH%
set TMP=Z:\HD_1\temp
set TEMP=Z:\HD_1\temp
set CARGO_TARGET_DIR=Z:\HD_1\DFK\BSafe\cargo-target-svm
set BSAFE_SO=%~dp0..\target\deploy\bsafe.so
if /I "%1"=="demo" (set BSAFE_DEMO_TIMERS=1) else (set BSAFE_DEMO_TIMERS=)

cd /d %~dp0
cargo test --test flows -- --test-threads=1
