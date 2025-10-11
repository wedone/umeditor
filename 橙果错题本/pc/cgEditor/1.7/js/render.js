/*
 * @Author: xkf
 * @Date: 2022-03-08 15:51:56
 * @LastEditTime: 2022-03-08 15:56:21
 * @LastEditors: xkf
 * @Description:
 */
var interfaceUrl = "//www.91chengguo.com/api/h5/";
if (get_url_params("tianyi")) {
	interfaceUrl = "//www.91chengguo.com/api/h5/tianyi/";
}
var problemId = get_url_params("problemId");
var matchId = get_url_params("matchId");
var loginToken = get_url_params("loginToken");
var isEdited = get_url_params("isEdited");
var type = get_url_params("type") || "";
var editType = get_url_params("editType");

//测试
if (problemId) {
	var timer = setInterval(function () {
		if (um) {
			render(problemId);
			clearInterval(timer);
		}
	}, 300);
}

function render() {
	var param = {
		loginToken: loginToken,
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
	var problemPageUrl = interfaceUrl + "com.orange.note.problem.rematch.text.do";
	ajax(false, "get", problemPageUrl, param, function (data) {
		if (data && data.content) {
			var questionText = data.content.questionText;
			var answerText = data.content.answerText;
			var originalUrl = data.content.originalUrl;
			//var dom = editType == 'img' ? '<img src="' +data.content.img + '" alt="">' : data.content.html;
			if (type && type != "undefined") {
				if (type == "stem") {
					um.setContent(questionText);
					$(".edited-show-title")[0].innerHTML = "题干编辑";
					// $('#my-editor')[0].innerHTML = questionText;
				} else if (type == "answer") {
					um.setContent(answerText);
					$(".edited-show-title")[0].innerHTML = "答案编辑";
					// $('#my-editor')[0].innerHTML = answerText;
				}
			}
			if (originalUrl) {
				$("#original-img")[0].src = originalUrl;
			}
		}
	});
}
