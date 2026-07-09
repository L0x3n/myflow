# Bygger och deployar MyFlow till GitHub Pages (gh-pages-branchen).
# Kräver: git-remote mot github.com/L0x3n/myflow och Pages aktiverat på gh-pages.
$ErrorActionPreference = "Stop"

$env:DEPLOY_BASE = "/myflow/"
try {
  node node_modules/typescript/bin/tsc --noEmit
  if ($LASTEXITCODE -ne 0) { throw "typecheck misslyckades" }
  node node_modules/vite/bin/vite.js build
  if ($LASTEXITCODE -ne 0) { throw "bygget misslyckades" }
} finally {
  Remove-Item Env:DEPLOY_BASE -ErrorAction SilentlyContinue
}

Push-Location dist
try {
  git init -q
  git checkout -qb gh-pages
  git add -A
  git commit -qm "deploy $(Get-Date -Format s)"
  git push -f https://github.com/L0x3n/myflow.git gh-pages
} finally {
  Pop-Location
  Remove-Item -Recurse -Force dist/.git -ErrorAction SilentlyContinue
}

Write-Host "Deployad: https://l0x3n.github.io/myflow/"
