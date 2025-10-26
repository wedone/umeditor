//得到cookie
function getCookie(cookie_name) {
    var allcookies = document.cookie;
    var cookie_pos = allcookies.indexOf(cookie_name); 
    if (cookie_pos != -1) {
        cookie_pos += cookie_name.length + 1;
        var cookie_end = allcookies.indexOf(";", cookie_pos);
        if (cookie_end == -1) {
            cookie_end = allcookies.length;
        }
        var value = unescape(allcookies.substring(cookie_pos, cookie_end));
    }
    if (value) {
        return value;
    } else {
        return '';
    }
}
//携带cookie
$.ajaxSettings.beforeSend = function (xhr, request) {
    xhr.withCredentials = true;
}

//ajax
function ajax(isApp, type, url, params, callbackFun) {
    var isQuery = { 'get': 'GET', 'post': 'POST' };
    $.ajax({
        type: isQuery[type],
        url: url,
        data: params,
        //contentType: false,
        headers: {
            //"Content-Type": "application/json;charset=utf-8",
            //'Access-Control-Allow-Origin': '*'
        },
        beforeSend: function (xhr, request) {
            xhr.withCredentials = true;
        },
        success: function (data) {
            callbackFun(data);
        },
        error: function (xhr, type) {
            console.log(xhr, type)
            forToast(isApp,xhr);
            callbackFun(null);
        }
    })
}

function forToast(isApp,msg) {
    if (isApp) {
        setTimeout(function(){
            lx.toast(msg);
        },600)
    }else {
        alert(msg);
    }
}
//对按钮的限制
function btnDisabled(disabled) {
    var saveBtn = $('.submit-btn');
    saveBtn.attr('disabled',disabled);

}
// 监听编辑器内容改变的
$("#my-editor")[0].addEventListener("blur", getContent);
// 监听dom中新增dom
// $("#my-editor")[0].addEventListener("change", getContent)
// 监听dom内容变化
$("#my-editor").bind("DOMSubtreeModified", getContent);
//得到编辑器中的内容 
function getContent() {
    if ($('#my-editor')[0].innerHTML.trim()) {
        var cont = UM.getEditor('my-editor').getContent();
        var type = get_url_params('type');
        listenerFinish({
            success: true,
            updateDetail: false,
            editedData: cont,
            editeType: type,
        })
    }
    // btnDisabled(true)
    // saveEditedText(cont);
}
//点击确定按钮
function sureClick() {
    $('.modal-bac').fadeOut();
    $('.submit-btn').attr("disabled",false);
}
var callbackData = {};
//保存接口
function saveEditedText(newText) {
    if(!newText){
        listenerFinish({
            success: false,
            msg: '编辑内容不能为空！',
            updateDetail: false
        })
        btnDisabled(false);
        return;
    }
    const param = {
        loginToken: loginToken,
        problemId: problemId,
    }
    if(type == 'question'){
        param.question = newText;
    }else {
        param.answer = newText;
    }
    const params = {
        service: 'com.orange.note.teacher.pc.edit.save.problem',
        param: JSON.stringify(param),
    }
    var sendUrl = '//www.91chengguo.com/api/pc/getJsonResult.do';
    ajax(false, 'post', sendUrl, params, function (data) {
        if(data && data.success && data.content){
            if(content == newText){
                listenerFinish({
                    success: true,
                    updateDetail: false,
                })
            }else {
                listenerFinish({
                    success: true,
                    updateDetail: true,
                })
            }
            
        }
        if(data && !data.success){
            btnDisabled(false);
            listenerFinish({
                success: false,
                msg: data.errMsg,
                updateDetail: false
            })
        } 
    }) 
}
//传给父级页面
function listenerFinish(data) {
    parent.postMessage(data,'*');
}
//监听粘贴板

document.querySelector('#my-editor').addEventListener('paste', (e) => {
    // console.log("paste", e.clipboardData.getData('text/html'))
    // // Prevent the default pasting event and stop bubbling
    // e.preventDefault();
    // e.stopPropagation();

    // // Get the clipboard data
    // let paste = (e.clipboardData || window.clipboardData).getData('text/html');
    // console.log("paste", e.clipboardData)
    // // // Do something with paste like remove non-UTF-8 characters
    // // paste = paste.replace(/style/gi, 'data-style');

    // // // Find the cursor location or highlighted area
    // // const selection = window.getSelection();

    // // // Cancel the paste operation if the cursor or highlighted area isn't found
    // // if (!selection.rangeCount) return false;
    // // var div = document.createElement("div");
    // // div.innerHTML = paste;
    // // // Paste the modified clipboard content where it was intended to go
    // // selection.getRangeAt(0).insertNode(div);
    // // //$("#tip").html(paste)
});