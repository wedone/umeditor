
//将数学公式latex格式转成html公式在转成图片；
function mathFormulaToImg(mathFormula,sendUrl,param) {
    //1.不存在数学公式
    if(!mathFormula.length){
        saveEditTxt(sendUrl,param);
        return;
    }
    //2.存在数学公式，但是是转好的图片
    //svgTocanvas(mathFormula);
    var mathFormulaArr = [];
    for(var j = 0; j < mathFormula.length; j++){
        var mathInnerHtml = mathFormula[j].innerHTML;
        if(!mathInnerHtml && !mathInnerHtml.includes('<img')) {
            mathFormulaArr.push(j);
        }
    }
    if(mathFormulaArr.length == mathFormula.length){
        saveEditTxt(sendUrl,param);
        return;
    }
    //3.存在数学公式,并且为latex格式
    var domUrlArr = [];
    var canvasWidthObj = {};
    for(var j = 0; j < mathFormula.length; j++){
        var latex = mathFormula[j].innerHTML;
        mathFormula[j].style.display = 'inline-block';
        mathFormula[j].style.width = 'auto';
        mathFormula[j].style.height = 'auto';
        mathFormula[j].style.paddingBottom = '3px';
        mathFormula[j].style.paddingTop = '2px';
        if(latex && !latex.includes('<img')){
            //latex转html
            console.log('katex',katex)
            katex.render(latex, mathFormula[j] , {
                throwOnError: false
            });    
        }   
             //html转base64 
        var canvasWidth = mathFormula[j].offsetWidth;
        var index = 0;
        canvasWidthObj[j] = canvasWidth;
        svgTocanvas(mathFormula[j]);
        html2canvas(mathFormula[j],{fontSize:8,fontWeight:100,allowTaint: true,  
            taintTest: false,  }).then(function(canvas){
            index++;
            var url = canvas.toDataURL();
            domUrlArr.push({
                url: url,
                width: canvasWidthObj[index-1],
            });
        })
    }
    var timer = setInterval(function(){
        if(domUrlArr.length){
            for(var j=0; j < mathFormula.length; j++){
                var latex = mathFormula[j].innerHTML;
                if(latex.includes('katex-mathml')){
                    mathFormula[j].innerHTML = '<img class="cg-math-formula" width="' + domUrlArr[j].width + 'px" src="'+ domUrlArr[j].url +'" />';
                    mathFormula[j].style.paddingBottom = '0';
                }
            }
            clearMathFormulaBox();
            saveEditTxt(sendUrl,param);
            clearInterval(timer);
        }
    },1000)
}
//对于复制进来的题，去除一并复制来的有影响展示的样式等
function clearCopiedStyle () {
    var allDom = $('.tem-save-editor').find('*');
    for(var i = 0; i < allDom.length; i++){
        //对于存在 不让文本换行的样式
        if(allDom[i].style.whiteSpace){
            allDom[i].style.whiteSpace = 'normal';
        }
    }
    //对于复制过来的文本中可能存在a标签中有外部链接的情况，加样式不让点击
    var allA = $('.tem-save-editor').find('a');
    for(var i = 0; i < allA.length; i++){
        allA[i].style.pointerEvents = 'none';
    }
}
//保存接口
function saveEditTxt(sendUrl,param) {
    clearCopiedStyle();
    var newText = $('.tem-save-editor')[0].innerHTML;
    if(type && type != 'undefined'){
        if(type == 'stem'){
            param.newText = newText;
        }else if(type == 'answer') {
            param.newAnswerText = newText;
        }
    }
    ajax(false, 'post', sendUrl, param, function (data) {
        if(data && data.content){
            notifit_dismiss();
            $('.modal-bac').fadeIn();
            $('.submit-btn').attr("disabled",false);
            $('.submit-btn')[0].innerHTML = '保存编辑';
        }else {
            
        }   
    }) 
}
//每次保存编辑，对于包装公式图片的 mathquill-embedded-latex盒子进行清除
function clearMathFormulaBox() {
    var editAfterTxt = $('.tem-save-editor .mathquill-embedded-latex');
    for(var i = 0; i < editAfterTxt.length; i++){
        $(editAfterTxt[i]).before(editAfterTxt[i].innerHTML);
    } 
    for(var i = 0; i < editAfterTxt.length; i++){
        $(editAfterTxt[i]).remove();
    }   
}
//将公式中的svg转化为canvas
function svgTocanvas(mathFormula){
    scrollTo(0, 0);
      var nodesToRecover = [];
      var nodesToRemove = [];
      var svgElem = $(mathFormula).find('svg');//divReport为需要截取成图片的dom的id
      for(var i = 0; i < svgElem.length; i++){
            var node = svgElem[i];
            node.style.position = 'absolute';
            node.style.left = '0';
            var nodeHeight = node.getBoundingClientRect().height + 'px';
            var nodeWidth = node.getBoundingClientRect().width + 'px';
            node.style.height = nodeHeight;
            //node.style.width = nodeWidth;
            var parentNode = node.parentNode;
            var svg = node.outerHTML.trim();
            var canvas = document.createElement('canvas');
            canvg(canvas, svg);
            if (node.style.position) {
                canvas.style.position += node.style.position;
                canvas.style.left += node.style.left;
                canvas.style.top += node.style.top;
            }

            nodesToRecover.push({
                parent: parentNode,
                child: node
            });
            parentNode.removeChild(node);
            nodesToRemove.push({
                parent: parentNode,
                child: canvas
            });
            parentNode.appendChild(canvas);
      }
}