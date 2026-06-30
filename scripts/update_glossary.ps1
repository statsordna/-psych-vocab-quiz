# 매일 실행: 새 vocab_*.xlsx를 모두 파싱해 glossary.json을 재생성하고 GitHub에 푸시
$ErrorActionPreference = "Stop"

$VocabDir = "C:\Users\andro\Documents\계량심리 용어"
$RepoDir  = "$VocabDir\app"
$PerlExe  = "C:\Program Files\Git\usr\bin\perl.exe"
$GitExe   = "C:\Program Files\Git\cmd\git.exe"
$BuildScript = "$RepoDir\scripts\build_glossary.pl"
$WorkDir = Join-Path $env:TEMP "psych_vocab_build"
$LogFile = "$RepoDir\scripts\update.log"

function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    Add-Content -Path $LogFile -Value $line -Encoding utf8
    Write-Output $line
}

Write-Log "=== 업데이트 시작 ==="

if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
New-Item -ItemType Directory -Path $WorkDir | Out-Null

$xlsxFiles = Get-ChildItem -Path $VocabDir -Filter "vocab_*.xlsx" |
    Where-Object { $_.Name -notlike "~$*" } |
    Sort-Object Name

if ($xlsxFiles.Count -eq 0) {
    Write-Log "엑셀 파일을 찾지 못했습니다: $VocabDir"
    exit 0
}
Write-Log "대상 파일: $($xlsxFiles.Name -join ', ')"

$dirArgs = @()
foreach ($f in $xlsxFiles) {
    $stem = [IO.Path]::GetFileNameWithoutExtension($f.Name)
    $zipPath = Join-Path $WorkDir "$stem.zip"
    $extractPath = Join-Path $WorkDir $stem
    Copy-Item $f.FullName $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
    $dirArgs += $extractPath
}

# PowerShell의 텍스트 파이프(Out-String 등)는 외부 프로그램 stdout을
# 시스템 코드페이지(cp949 등)로 잘못 디코딩해 한글을 깨뜨릴 수 있다.
# cmd.exe의 ">" 리다이렉션은 바이트 그대로 파일에 써서 이를 회피한다.
$glossaryPath = "$RepoDir\glossary.json"
$quotedArgs = ($dirArgs | ForEach-Object { '"' + $_ + '"' }) -join ' '
$cmdLine = '"' + $PerlExe + '" "' + $BuildScript + '" ' + $quotedArgs + ' > "' + $glossaryPath + '"'
cmd /c $cmdLine
if ($LASTEXITCODE -ne 0) { Write-Log "오류: glossary.json 생성 실패 (perl exit $LASTEXITCODE)"; throw "glossary.json 생성 실패" }
Write-Log "glossary.json 생성 완료"

Set-Location $RepoDir
& $GitExe add glossary.json
if ($LASTEXITCODE -ne 0) { Write-Log "오류: git add 실패 (exit $LASTEXITCODE)"; throw "git add 실패" }

& $GitExe diff --cached --quiet
$hasChanges = ($LASTEXITCODE -ne 0)

if ($hasChanges) {
    & $GitExe commit -m "용어집 업데이트 $(Get-Date -Format 'yyyy-MM-dd')"
    if ($LASTEXITCODE -ne 0) { Write-Log "오류: git commit 실패 (exit $LASTEXITCODE)"; throw "git commit 실패" }
    & $GitExe pull --rebase origin main
    if ($LASTEXITCODE -ne 0) { Write-Log "오류: git pull 실패 (exit $LASTEXITCODE)"; throw "git pull 실패" }
    & $GitExe push origin main
    if ($LASTEXITCODE -ne 0) { Write-Log "오류: git push 실패 (exit $LASTEXITCODE)"; throw "git push 실패" }
    Write-Log "glossary.json 업데이트 및 푸시 완료"
} else {
    Write-Log "변경 사항 없음 - 푸시 생략"
}
