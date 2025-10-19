# MathQuill 渲染验证测试启动脚本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MathQuill 渲染验证功能测试" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在正确的目录
$currentDir = Get-Location
$testFile = Join-Path $currentDir "umeditor\test-render-validation.html"

if (-not (Test-Path $testFile)) {
    Write-Host "错误: 找不到测试文件" -ForegroundColor Red
    Write-Host "请确保在 mathquill 项目根目录运行此脚本" -ForegroundColor Red
    Write-Host ""
    Write-Host "当前目录: $currentDir" -ForegroundColor Yellow
    Write-Host "预期文件: $testFile" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ 找到测试文件: umeditor\test-render-validation.html" -ForegroundColor Green
Write-Host ""

# 检查是否有 Python
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
}

if ($pythonCmd) {
    Write-Host "正在启动本地 HTTP 服务器..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "测试页面地址:" -ForegroundColor Yellow
    Write-Host "  http://localhost:8000/umeditor/test-render-validation.html" -ForegroundColor Green
    Write-Host ""
    Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Gray
    Write-Host ""
    
    # 延迟 1 秒后打开浏览器
    Start-Sleep -Seconds 1
    Start-Process "http://localhost:8000/umeditor/test-render-validation.html"
    
    # 启动 HTTP 服务器
    & $pythonCmd -m http.server 8000
} else {
    Write-Host "未找到 Python，将尝试直接在浏览器中打开文件..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⚠️  警告: 直接打开文件可能导致以下问题:" -ForegroundColor Yellow
    Write-Host "  - CORS 限制导致资源加载失败" -ForegroundColor Gray
    Write-Host "  - 某些功能无法正常工作" -ForegroundColor Gray
    Write-Host ""
    Write-Host "建议安装 Python 并使用 HTTP 服务器:" -ForegroundColor Cyan
    Write-Host "  python -m http.server 8000" -ForegroundColor Green
    Write-Host ""
    
    $choice = Read-Host "是否仍要在浏览器中打开? (Y/N)"
    if ($choice -eq 'Y' -or $choice -eq 'y') {
        Start-Process $testFile
    }
}
