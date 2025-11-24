Java.perform(function () {
    console.log("[*] 正在等待 libsecurity.so 加载...");

    // 监控库加载
    var libraryName = "libsecurity.so";
    var loaded = false;

    // 尝试直接Hook（如果已加载）
    var baseAddr = Module.findBaseAddress(libraryName);
    if (baseAddr) {
        console.log("[*] " + libraryName + " 已加载，基址: " + baseAddr);
        hookMD5(baseAddr);
        loaded = true;
    }

    // 如果未加载，则等待加载
    if (!loaded) {
        const android_dlopen_ext = Module.findExportByName(null, "android_dlopen_ext");
        if (android_dlopen_ext) {
            Interceptor.attach(android_dlopen_ext, {
                onEnter: function (args) {
                    this.path = args[0].readCString();
                },
                onLeave: function (retval) {
                    if (this.path && this.path.indexOf(libraryName) >= 0) {
                        console.log("[*] 检测到 " + libraryName + " 加载");
                        var baseAddr = Module.findBaseAddress(libraryName);
                        hookMD5(baseAddr);
                    }
                }
            });
        }
    }

    function hookMD5(baseAddr) {
        // zbw_md5 的偏移地址需要根据具体版本确定，或者直接通过符号查找
        // 这里使用符号查找，更通用
        var md5Func = Module.findExportByName(libraryName, "zbw_md5");

        // 如果找不到导出函数，尝试通过偏移（v8.96版本偏移可能不同，建议优先用Export）
        // 如果是 stripped binary，需要配合 IDA 分析确定偏移

        if (md5Func) {
            console.log("[*] 找到 zbw_md5 函数地址: " + md5Func);
            Interceptor.attach(md5Func, {
                onEnter: function (args) {
                    try {
                        // 读取第一个参数（输入字符串）
                        var inputStr = args[0].readCString();
                        console.log("\n[+] 捕获到签名计算!");
                        console.log("========================================");
                        console.log("[原始字符串]: " + inputStr);

                        // 提取密钥
                        var match = inputStr.match(/&secretKey=([^&]+)/);
                        if (match && match[1]) {
                            console.log("[发现密钥]: " + match[1]);
                            console.log("========================================");
                        }
                    } catch (e) {
                        console.log("Error: " + e);
                    }
                }
            });
            console.log("[*] Hook 成功，请在APP中触发任意请求（如刷新列表）...");
        } else {
            console.log("[-] 未找到 zbw_md5 导出函数，尝试使用通用拦截...");
            // 备用方案：拦截 NativeSecuritySDK.signEncrypt
            var signEncrypt = Java.use("com.orange.note.security.NativeSecuritySDK");
            signEncrypt.signEncrypt.implementation = function (str) {
                console.log("\n[+] 捕获到 signEncrypt 调用!");
                console.log("========================================");
                console.log("[输入参数]: " + str);
                // 注意：这里可能还没拼接密钥，密钥是在 native 层拼接的
                // 所以必须 Hook native 层才能看到最终密钥
                return this.signEncrypt(str);
            }
        }
    }
});
