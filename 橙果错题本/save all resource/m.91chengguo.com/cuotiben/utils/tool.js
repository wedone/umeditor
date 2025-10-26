//获取地址中用户信息 （已经废弃）
function getUserTokenOrId(key) {
    var getUrl = location.search;
    var filterUrl = getUrl.substring(1, getUrl.length);
    var urlArry = filterUrl.split('&');
    var loginToken = '';
    urlArry.map(function (ite, idx) {
        var item = ite.split('=');
        if (item[0] == key) {
            loginToken = item[1];
        }
    })
    return loginToken;
}

//下载app （已经废弃）
function downloadApp() {
    var u = navigator.userAgent;
    var d = new Date();
    var t0 = d.getTime();
    if (u.indexOf('Android') > -1 || u.indexOf('Linux') > -1) {
        //Android
        if (open_app('en://startapp')) {
            open_app('en://startapp');
        } else {
            var delay = setInterval(function () {
                var d = new Date();
                var t1 = d.getTime();
                if (t1 - t0 < 3000 && t1 - t0 > 2000) {
                    window.location.href = "http://a.app.qq.com/o/simple.jsp?pkgname=com.orange.note";
                }
                if (t1 - t0 >= 3000) {
                    clearInterval(delay);
                }
            }, 1000);
        }
    } else if (u.indexOf('iPhone') > -1) {
        //IOS
        if (open_app('ios--scheme')) {
            open_app('ios--scheme');
        } else {
            var delay = setInterval(function () {
                var d = new Date();
                var t1 = d.getTime();
                if (t1 - t0 < 3000 && t1 - t0 > 2000) {
                    window.location.href = "itms-apps://itunes.apple.com/app/id1240025662";
                }
                if (t1 - t0 >= 3000) {
                    clearInterval(delay);
                }
            }, 1000);
        }
    }
}

//优化后的下载app
function download_app(appType) {
    //默认为家长端的
    var pkgname = 'com.orange.note';
    var appleId = 'id1240025662';
    if(appType == 'teacher'){
        pkgname = 'com.orange.note.teacher';
        appleId = 'id1448019665';
    }
    var u = navigator.userAgent;
    var d = new Date();
    var t0 = d.getTime();
    var isDownload = false;
    if (u.indexOf('Android') > -1 || u.indexOf('Linux') > -1) {
        //Android
        if (open_app('en://startapp')) {
            open_app('en://startapp');
        } else {
            var delay = setInterval(function () {
                var d = new Date();
                var t1 = d.getTime();
                if (t1 - t0 < 1000 && t1 - t0 > 0) {
                    window.location.href = "http://a.app.qq.com/o/simple.jsp?pkgname=" + pkgname;
                }
                if (t1 - t0 >= 3000) {
                    clearInterval(delay);
                }
            }, 300);
        }
    } else if (u.indexOf('iPhone') > -1) {
        //IOS
        if (open_app('ios--scheme')) {
            open_app('ios--scheme');
        } else {
            var delay = setInterval(function () {
                var d = new Date();
                var t1 = d.getTime();
                if (t1 - t0 < 1000 && t1 - t0 > 0) {
                    window.location.href = "itms-apps://itunes.apple.com/app/" + appleId;
                }
                if (t1 - t0 >= 3000) {
                    clearInterval(delay);
                }
            }, 300);
        }
    }
}
function open_app(src) {
    var ifr = document.createElement('iframe');
    ifr.src = src;
    ifr.style.display = 'none';
    document.body.appendChild(ifr);
    window.setTimeout(function () {
        document.body.removeChild(ifr);
    }, 2000);
}

//封装原生ajax
function get(url, fn) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.withCredentials = true;
    xhr.send('');
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            fn(JSON.parse(xhr.responseText));
        }
    }
}
function post(url, fn, value) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.send(value);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            fn(JSON.parse(xhr.responseText));
        }
    }
}


//判断是微信还是qq还是其他
function is_wx_qq() {
    var ua = navigator.userAgent.toLowerCase();
    if (ua.match(/MicroMessenger/i) == "micromessenger") {
        return "WX";
    } else if (ua.match(/QQ/i) == "qq") {
        return "QQ";
    }
    return false;
}

//获取地址栏参数
function get_url_params(key) {
    var getUrl = window.location.hash || window.location.search;
        getUrl = getUrl.replace(/[^.*\?$]*/i,'');
    var filterUrl = getUrl.substring(1, getUrl.length);
    var urlArry = filterUrl.split('&');
    var value = '';
    urlArry.map(function (ite, idx) {
        var item = ite.split('=');
        if (item[0] == key) {
            value = item[1];
        }
    })
    return value;
}
//特殊情况处理
//获取地址栏参数 通过 location.search
function get_url_params_search(key) {
    var getUrl = window.location.search;
        getUrl = getUrl.replace(/[^.*\?$]*/i,'');
    var filterUrl = getUrl.substring(1, getUrl.length);
    var urlArry = filterUrl.split('&');
    var value = '';
    urlArry.map(function (ite, idx) {
        var item = ite.split('=');
        if (item[0] == key) {
            value = item[1];
        }
    })
    return value;
}

//判断是微信打开还是qq还是橙果app还是其他浏览器
function is_which_browser() {
    var ua = navigator.userAgent.toLowerCase();
    if (ua.match(/MicroMessenger/i) == "micromessenger") {
        return "WX";
    } else if (ua.match(/QQ/i) == "qq") {
        return "QQ";
    }else if(ua.match(/91chengguo/i) == "91chengguo"){
        return "APP"
    }
    return false;
}

//es5 数组去重
function remove_duplicated_item(arr) {
    for (var i = 0; i < arr.length; i++) {
        if (arr.indexOf(arr[i]) != i) {
            arr.splice(i,1);
            i--;
        }
    }
    return arr;
}

//cookie 操作
var all_tools_fun = {
    cookie: {
        set:function(key,val,time){
            var date=new Date(); 
            var expiresDays=time;  
            date.setTime(date.getTime()+expiresDays*24*3600*1000); 
            document.cookie=key + "=" + val +";expires="+date.toGMTString();  
        },
        get:function(key){
            
            var cookies = document.cookie.replace(/[ ]/g,"");  
            var arrCookie = cookies.split(";")  
            var tips; 
            for(var i=0;i<arrCookie.length;i++){   
                var arr=arrCookie[i].split("=");  
                if(key==arr[0]){  	
                    tips=arr[1];   
                    break;   	
                }
            }
            return tips;
        },
        del:function(key){ //删除cookie方法
             var date = new Date(); 
             date.setTime(date.getTime()-10000); 
             document.cookie = key + "=v; expires =" +date.toGMTString();
        }
    },
}

//数组去重 （可含json对象元素的数组去重）
function arry_de_duplication(orignArray,condition) {
    //orignArray 去重的数组，可以是含有json元素的数组，
    //condition 去重需要的条件)(数组) ['a','b']
    function obj2key(obj, keys){  
        var n = keys.length,  
            key = [];  
        while(n--){  
            key.push(obj[keys[n]]);  
        }  
        return key.join('|');  
    }  
    //去重操作
    function uniqeByKeys(array,keys){  
        var arr = [];  
        var hash = {};  
        for (var i = 0, j = array.length; i < j; i++) {  
            var k = obj2key(array[i], keys);  
            if (!(k in hash)) {  
                hash[k] = true;  
                arr .push(array[i]);  
            }  
        }  
        return arr ;  
    }  
    return uniqeByKeys(orignArray,condition);
}

// 浏览器不支持es6的assign；新增assign(合并对象)
function es6_assign_polyfill() {
    if (!Object.assign) {
        Object.defineProperty(Object, "assign", {
            enumerable: false,
            configurable: true,
            writable: true,
            value: function (target, firstSource) {
                "use strict";
                if (target === undefined || target === null)
                    throw new TypeError("Cannot convert first argument to object");
                var to = Object(target);
                for (var i = 1; i < arguments.length; i++) {
                    var nextSource = arguments[i];
                    if (nextSource === undefined || nextSource === null) continue;
                    var keysArray = Object.keys(Object(nextSource));
                    for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
                        var nextKey = keysArray[nextIndex];
                        var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
                        if (desc !== undefined && desc.enumerable) to[nextKey] = nextSource[nextKey];
                    }
                }
                return to;
            }
        });
    }
}

//得到用户网络状态（除了app内嵌的网页）
function get_network_type() {
    var ua = navigator.userAgent;
    var networkStr = ua.match(/NetType\/\w+/) ? ua.match(/NetType\/\w+/)[0] : 'NetType/other';
    networkStr = networkStr.toLowerCase().replace('nettype/', '');
    var networkType;
    switch(networkStr) {
        case 'wifi':
            networkType = 'wifi';
            break;
        case '4g':
            networkType = '4g';
            break;
        case '3g':
            networkType = '3g';
            break;
        case '3gnet':
            networkType = '3g';
            break;
        case '2g':
            networkType = '2g';
            break;
        default:
            networkType = 'other';
    }
    return networkType;
}

//判断移动端 是否为ios还是安卓
//whichOne传 ios或者Android 单独判断是ios还是Android ；whichOne不传的话会返回具体是哪个端
function is_ios_or_Android(whichOne) {//whichOne : ios , Android , 或者不传
    var browser = {
        versions: function () {
            var u = navigator.userAgent;
            return {
                ios: !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/), //ios终端
                android: u.indexOf('Android') > -1 || u.indexOf('Linux') > -1, //android终端或uc浏览器
                iPhone: u.indexOf('iPhone') > -1, //是否为iPhone或者QQHD浏览器
                iPad: u.indexOf('iPad') > -1, //是否iPad
            };
        }(),
    };
    var v = "",isIos = false,isAndriod = false;
    //安卓
    if (browser.versions.android) {
        v = 'Android';
        isIos = false;
        isAndriod = true;
    }
    //ios
    if (browser.versions.iPhone || browser.versions.iPad || browser.versions.ios) {
        v = 'IOS';
        isIos = true;
        isAndriod = false;
    }
    //非移动端
    if(!isIos && !isAndriod){
        return 'NonMobileEnd';
    }
    //whichOne不传，明确知道哪个端
    if(!whichOne){
        return v;
    }
    if(whichOne == 'ios'){
        return isIos;
    }else if(whichOne == 'Android'){
        return isAndriod;
    }else {
        return 'is_ios_or_Android参数请传 “ios”或者 “Android” 或者不传';
    }
}

//加载移动端的H5调试面板 vconsole.js
function add_vconsole_tool() {
	var newScript = document.createElement("script");
	newScript.setAttribute("src", "//m.91chengguo.com/cuotiben/utils/vconsole.min.js");
	newScript.setAttribute("type", "text/javascript");
	var heads = document.getElementsByTagName("head");
	heads[0].appendChild(newScript); 
	newScript.onload = function () {
	    var debug = new VConsole();
	}
}






















