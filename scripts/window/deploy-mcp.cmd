@echo off
setlocal

REM ============================================================
REM Pangolinfo VOC MCP - build + push to Aliyun ACR
REM
REM Usage:
REM   deploy-mcp.cmd            (tag = latest)
REM   deploy-mcp.cmd 0.2.0      (tag = 0.2.0, recommended for prod)
REM
REM Mirrors pangolinfo-mcp/scripts/window/deploy-mcp.cmd:
REM   .cmd entry (Windows) -> wsl -> docker-mcp.sh -> docker build/push.
REM
REM Note: docker build is done inside WSL (the Dockerfile multistage
REM image runs npm ci + npm run build itself, so we do not need to
REM build locally on Windows). 国内->新加坡 ACR 国际版只通过 WSL2 网络栈才连得上。
REM ============================================================

cd /d "%~dp0\..\.."

set "TAG=%~1"
if "%TAG%"=="" set "TAG=latest"

echo === Building and pushing voc-mcp:%TAG% ===
echo (full build runs inside the Docker image, via WSL)
echo.

wsl ./scripts/window/docker-mcp.sh %TAG% || (
    echo.
    echo ERROR: docker build/push failed.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Done. Image pushed:
echo   registry-intl.ap-southeast-1.aliyuncs.com/pangolinfo-prod/voc-mcp:%TAG%
echo   registry-intl.ap-southeast-1.aliyuncs.com/pangolinfo-prod/voc-mcp:latest
echo.
echo Next step: trigger rolling update in ACK console
echo   crawler cluster -^> Workloads -^> Deployments -^> voc-mcp
echo   -^> Update -^> change image tag to %TAG% -^> Submit
echo   2 replicas roll one at a time, zero downtime.
echo ============================================================
pause
