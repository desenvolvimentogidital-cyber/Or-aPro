# OrçaPro - publicação inicial sem sobrescrever histórico remoto
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$repository = 'https://github.com/desenvolvimentogidital-cyber/Or-aPro.git'
function CheckGit($description) {
    if ($LASTEXITCODE -ne 0) { throw "Falha em: $description. Confira as mensagens do Git." }
}
try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git não instalado. Instale Git para Windows antes de prosseguir.' }
    if (-not (Test-Path 'package.json')) { throw 'Abra este script na pasta raiz do OrçaPro, onde está package.json.' }
    if (Test-Path '.env.local') { Write-Host 'Aviso: .env.local local será ignorado pelo Git.' -ForegroundColor Yellow }
    if (-not (Test-Path '.git')) { git init -b main; CheckGit 'inicializar Git' }
    $remotes = @(git remote)
    CheckGit 'listar repositórios remotos'
    if ($remotes -contains 'origin') {
        $origin = git remote get-url origin; CheckGit 'identificar repositório remoto'
        if ($origin -ne $repository) { throw "Há um remote origin diferente ($origin). Por segurança, revise antes de publicar." }
    } else {
        git remote add origin $repository; CheckGit 'adicionar repositório remoto'
    }
    $remoteHeads = @(git ls-remote --heads origin 2>&1)
    CheckGit 'consultar GitHub'
    if ($remoteHeads.Count -gt 0 -and ($remoteHeads -join '').Trim()) {
        throw 'O GitHub já possui commits. Para preservar dados, o envio automático parou sem sobrescrever o repositório.'
    }
    git add -A; CheckGit 'selecionar arquivos'
    $staged = @(git diff --cached --name-only)
    CheckGit 'listar arquivos selecionados'
    $unsafe = @($staged | Where-Object { ($_ -match '(^|/)\.env(\.|$)' -and $_ -notmatch '(^|/)\.env\.example$') -or $_ -match '(^|/)(node_modules/|dist/|\.git/|\.test-dist/)' })
    if ($unsafe.Count -gt 0) { throw "Arquivos proibidos no envio: $($unsafe -join ', ')" }
    if ($staged.Count -eq 0) { throw 'Não há arquivos novos para enviar.' }
    git commit -m 'chore: publica OrçaPro v2.4.1 para homologação'; CheckGit 'registrar versão'
    git push -u origin main; CheckGit 'enviar para GitHub'
    Write-Host 'Publicação no GitHub concluída. Revise os testes no GitHub Actions.' -ForegroundColor Green
} catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
