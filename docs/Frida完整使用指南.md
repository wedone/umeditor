# Frida完整使用指南

## 准备工作

### 1. 在Android设备上安装Frida Server

#### 下载Frida Server

1. 查看设备架构：
```bash
adb shell getprop ro.product.cpu.abi
```

2. 根据架构下载对应版本：
- ARM64: `frida-server-17.5.1-android-arm64`
- ARM32: `frida-server-17.5.1-android-arm`

下载地址：https://github.com/frida/frida/releases

#### 安装到设备

```bash
# 1. 推送到设备
adb push frida-server-17.5.1-android-arm64 /data/local/tmp/frida-server

# 2. 添加执行权限
adb shell chmod 755 /data/local/tmp/frida-server

# 3. 启动Frida Server（需要root）
adb shell su -c "/data/local/tmp/frida-server &"
```

### 2. 验证连接

```bash
# 查看设备
frida-ps -U

# 应该能看到设备上运行的进程列表
```

## 使用Hook脚本

### 方法1：Attach模式（推荐）

```bash
# 1. 先启动橙果APP
# 2. 然后运行Frida（不用-f参数）
frida -U com.orange.note -l d:\vc\umeditor\hook_zbw_md5.js

# 3. 在APP中触发一次API请求（如查看错题）
```

### 方法2：Spawn模式

如果Attach失败，修改脚本延迟：

```bash
# 使用spawn模式，但增加等待时间
frida -U -f com.orange.note -l d:\vc\umeditor\hook_zbw_md5.js --no-pause
```

### 方法3：手动Attach

```bash
# 1. 启动Frida交互模式
frida -U com.orange.note

# 2. 在Frida控制台中粘贴脚本内容
# 3. 在APP中触发请求
```

## 故障排除

### 问题1：spawn超时

**原因**：APP启动太慢或被加固保护

**解决**：
```bash
# 使用attach模式而不是spawn
frida -U com.orange.note -l hook_zbw_md5.js
```

### 问题2：找不到进程

**原因**：Frida Server未启动

**解决**：
```bash
# 重新启动Frida Server
adb shell su -c "killall frida-server"
adb shell su -c "/data/local/tmp/frida-server &"

# 验证
frida-ps -U
```

### 问题3：权限被拒绝

**原因**：设备未root或Frida Server权限不足

**解决**：
```bash
# 确保以root权限运行
adb shell su -c "/data/local/tmp/frida-server &"
```

## 预期输出

成功Hook后，当APP发起API请求时，会看到：

```
[zbw_md5] ========== 输入 ==========
context={"os":"Android\\/13",...}&param={"problemId":"123"}&service=com.orange.note.query.problem.tag.page&t=1234567890fnecrerKuy=橙果密钥2024
[zbw_md5] 长度: 256
[zbw_md5] ========== 输出 ==========
A1B2C3D4E5F6...
```

从输入中可以看到：
1. 完整的参数拼接
2. 魔数：`fnecrerKuy=`
3. **密钥**：`橙果密钥2024`（示例）

## 快速启动脚本

创建 `start_frida.bat`：

```batch
@echo off
echo [1] 检查Frida Server...
adb shell su -c "ps | grep frida-server"
if errorlevel 1 (
    echo [*] 启动Frida Server...
    adb shell su -c "/data/local/tmp/frida-server &"
    timeout /t 2
)

echo [2] 验证连接...
frida-ps -U

echo [3] 启动Hook...
echo 请先在手机上打开橙果APP，然后按任意键继续...
pause

frida -U com.orange.note -l hook_zbw_md5.js
```

## 备选方案：使用已有APP进程

如果spawn一直失败：

```bash
# 1. 查找APP的PID
frida-ps -U | findstr orange

# 2. 直接attach到PID
frida -U -p <PID> -l hook_zbw_md5.js
```

## 下一步

获取到MD5输入后：
1. 记录完整的字符串
2. 提取密钥部分
3. 用JavaScript实现签名算法
4. 集成到Tampermonkey脚本
