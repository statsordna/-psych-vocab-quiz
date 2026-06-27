# 매일 실행: 새 vocab_*.xlsx를 모두 파싱해 glossary.json을 재생성하고 GitHub에 푸시
$ErrorActionPreference = "Stop"

$VocabDir = "C:\Users\andro\Documents\계량심리 용어"
$RepoDir  = "$VocabDir\app"
$PerlExe  = "C:\Program Files\Git\usr\bin\perl.exe"
$BuildScript = "$RepoDir\scripts\build_glossary.pl"
$WorkDir = Join-Path $env:TEMP "psych_vocab_build"

if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
New-Item -ItemType Directory -Path $WorkDir | Out-Null

$xlsxFiles = Get-ChildItem -Path $VocabDir -Filter "vocab_*.xlsx" |
    Where-Object { $_.Name -notlike "~$*" } |
    Sort-Object Name

if ($xlsxFiles.Count -eq 0) {
    Write-Output "엑셀 파일을 찾지 못했습니다: $VocabDir"
    exit 0
}

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
if ($LASTEXITCODE -ne 0) { throw "glossary.json 생성 실패 (perl exit $LASTEXITCODE)" }

Set-Location $RepoDir
git add glossary.json
$staged = git diff --cached --quiet; $hasChanges = ($LASTEXITCODE -ne 0)

if ($hasChanges) {
    git commit -m "용어집 업데이트 $(Get-Date -Format 'yyyy-MM-dd')"
    git push origin main
    Write-Output "glossary.json 업데이트 및 푸시 완료"
} else {
    Write-Output "변경 사항 없음 - 푸시 생략"
}
