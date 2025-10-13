<#
PowerShell helper: bump-userscript-version.ps1
用法示例：
  # 在仓库根目录运行（默认会修改 scripts/um-inject.user.js）
  pwsh .\tools\bump-userscript-version.ps1

可选参数：
  -ScriptPath <path>    指定 userscript 文件路径（默认 ../scripts/um-inject.user.js 相对于脚本位置）

作用：以时间戳（yyyy.MM.dd.HHmmss）替换 userscript 头部的 @version 值，方便 Tampermonkey 识别为新版本并自动更新。
#>
param(
    [string]$ScriptPath = "$PSScriptRoot\..\scripts\um-inject.user.js"
)
$fullPath = Resolve-Path -Path $ScriptPath -ErrorAction SilentlyContinue
if(-not $fullPath){
    Write-Error "Userscript not found at path: $ScriptPath"
    exit 1
}
$fullPath = $fullPath.Path
Write-Host "Updating userscript version in: $fullPath"

try{
    $content = Get-Content -Path $fullPath -Raw -Encoding UTF8
}catch{
    Write-Error "Failed to read file: $_"
    exit 1
}

# 生成版本号
$newVersion = (Get-Date).ToString('yyyy.MM.dd.HHmmss')
# 用正则替换首个 @version 行
$pattern = '(?m)^(//\s*@version\s+).*\r?$'
$replacement = "`$1$newVersion"
if([Regex]::IsMatch($content, $pattern)){
    $newContent = [Regex]::Replace($content, $pattern, $replacement, 1)
}else{
    # 如果没有找到 @version，则在头部附近插入
    $insertPoint = 0
    $lines = $content -split "\r?\n"
    for($i=0;$i -lt $lines.Length;$i++){
        if($lines[$i] -match '^//\s*==UserScript==') { $insertPoint = $i+1; break }
    }
    $lines = $lines[0..($insertPoint-1)] + ("// @version      $newVersion") + $lines[$insertPoint..($lines.Length-1)]
    $newContent = $lines -join "`n"
}

try{
    Set-Content -Path $fullPath -Value $newContent -Encoding UTF8
    Write-Host "Updated @version -> $newVersion"
}catch{
    Write-Error "Failed to write file: $_"
    exit 1
}
