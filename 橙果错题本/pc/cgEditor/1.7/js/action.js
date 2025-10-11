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
		return "";
	}
}
//携带cookie
$.ajaxSettings.beforeSend = function (xhr, request) {
	xhr.withCredentials = true;
};

//ajax
function ajax(isApp, type, url, params, callbackFun) {
	var isQuery = { get: "GET", post: "POST" };
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
			if (!data.success) {
				console.log(data.errMsg);
				if (!isApp && data.errCode == -9) {
					//微信端 微信授权
					var h5Cookie =
						data.content.h5_cookie_key || getCookie("h5_cookie_key");
					var url =
						window.location.href.split("#")[0] + "&h5_cookie_key=" + h5Cookie;
					url = encodeURIComponent(url);
					window.location.href =
						data.content.oauthUrl + "?h5RedirectURL=" + url;
					return;
				}
				//微信端 需要的
				if (data && data.content && data.content.registerState) {
					return;
				}
				forToast(isApp, data.errMsg);
			}
		},
		error: function (xhr, type) {
			console.log(xhr, type);
			forToast(isApp, xhr);
			callbackFun(null);
		},
	});
}

function forToast(isApp, msg) {
	if (isApp) {
		setTimeout(function () {
			lx.toast(msg);
		}, 600);
	} else {
		alert(msg);
	}
}

//得到编辑器中的内容
function getContent() {
	$(".submit-btn")[0].innerHTML = "正在保存 ...";
	$(".submit-btn").attr("disabled", true);
	var cont = UM.getEditor("my-editor").getContent();
	saveEditedText(cont);
}

//点击确定按钮
function sureClick() {
	$(".modal-bac").fadeOut();
	$(".submit-btn").attr("disabled", false);
	//render();
}

//保存接口
function saveEditedText(newText) {
	if (!newText) {
		alert("编辑内容不能为空！");
		return;
	}
	//notice();
	var param = {
		loginToken: loginToken,
		newText: null,
		newAnswerText: null,
		isEdited: isEdited,
	};
	if (problemId && problemId != "undefined") {
		param.problemId = problemId;
	}
	if (matchId && matchId != "undefined") {
		param.matchId = matchId;
	}
	if (!param.isEdited || param.isEdited == "undefined") {
		delete param.isEdited;
	}
	var sendUrl = interfaceUrl + "com.orange.note.problem.save.editedtext.do";
	if (type && type != "undefined") {
		if (type == "stem") {
			param.newText = newText;
		} else if (type == "answer") {
			param.newAnswerText = newText;
		}
	}
	ajax(false, "post", sendUrl, param, function (data) {
		if (data && data.content) {
			$(".modal-bac").fadeIn();
			$(".submit-btn").attr("disabled", false);
			$(".submit-btn")[0].innerHTML = "保存编辑";
		} else {
		}
	});

	// 数学公式的处理 后的
	//--------------
	// $('.tem-save-editor')[0].innerHTML = newText;
	// var mathLatex = $('.tem-save-editor .mathquill-embedded-latex');
	// mathFormulaToImg(mathLatex,sendUrl,param);
}
//提示
function notice() {
	notif({
		type: "warning",
		msg: "正在保存中...",
		position: "center",
		opacity: 0.8,
	});
}
