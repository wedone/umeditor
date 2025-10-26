var loginToken = get_url_params('loginToken');
var problemId = get_url_params('problemId');
var type = get_url_params('type');
var content = "";
window.addEventListener('message', render, false);
function render(e) {
  if (e.origin == 'http://127.0.0.1' || 'https://www.91chengguo.com' || 'http://www.91chengguo.com') {
    //e.source.postMessage('收到了吗', e.origin);
    if (e.data) {
      var { editData, index } = e.data;
      if (um) {
        um.setContent(editData);
        content = editData;
      }
    }
  }
}