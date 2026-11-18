$root = $PSScriptRoot

Write-Host "`n=== Backend ===" -ForegroundColor Cyan
Set-Location "$root\backend"
npm install; if (-not $?) { Write-Host "npm install failed" -ForegroundColor Red; exit 1 }
npm run build; if (-not $?) { Write-Host "build failed" -ForegroundColor Red; exit 1 }
npm run migrate; if (-not $?) { Write-Host "migrate failed" -ForegroundColor Red; exit 1 }

Write-Host "`n=== Frontend ===" -ForegroundColor Cyan
Set-Location "$root\frontend"
npm install; if (-not $?) { Write-Host "npm install failed" -ForegroundColor Red; exit 1 }
npm run build; if (-not $?) { Write-Host "build failed" -ForegroundColor Red; exit 1 }

Write-Host "`n=== PM2 Restart ===" -ForegroundColor Cyan
Set-Location $root
pm2 restart ecosystem.config.js --update-env

Write-Host "`nDone!" -ForegroundColor Green
