(function(comm_o, app_o){
	if(comm_o.isDvlp || window.tsoc_o) return;
	
	var tsoc_o = {};
	
	var _initCallBack = null;
	var _studentsCallBack = null;
	var _previewCallBack = null;
	
	///////////////////////////////////////////////////////////////////////
	tsoc_o.gotoBook = function(bookid, booklist){
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'gotoBook', msg: { bookid: bookid, booklist: booklist} }, '*');
	};
	tsoc_o.gotoBookByKey = function(bookkey){
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'gotoBookByKey', msg: { bookkey: bookkey} }, '*');
	};
	tsoc_o.exitBook = function(){
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'exitBook'}, '*');
	};
	tsoc_o.launchTool = function(conceptKey){
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'launchTool', msg: conceptKey}, '*');
	};
	tsoc_o.launchPadTool = function(conceptKey){
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'launchPadTool', msg: conceptKey}, '*');
	};
	tsoc_o.getNaviInfo = function(curriType) {
		//'extra'|'report'|'teaching'|'pen'|'menu'|'book'|'navi'
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'navi',  subType: 'getNaviInfo', curriType: curriType}} , '*');	
	};
	tsoc_o.exitClass = function() {
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'navi',  subType: 'exitClass'}} , '*');	
	};
	tsoc_o.logOut = function() {
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'navi',  subType: 'logout'}} , '*');	
	};
	tsoc_o.useFractionBar = function(){
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalDisplay', msg: { to: 'extra', display: true }} , '*');	
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'extra', info: {type: 'useFraction', data: ''}}} , '*');	
	};
	tsoc_o.uploadImageToServer = function(base64, mixPen, rect, save){
		console.log("tsoc_o.uploadImageToServer", mixPen, rect, save);
		window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'uploadImageToServer', msg : {src: base64, mixPen: mixPen, rect: rect, save: save}}, '*');		
	};
	tsoc_o.getBookCaptureInfo = function(bookkey){
		console.log("tsoc_o.getBookCaptureInfo", bookkey);
		window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'getBookCaptureInfo', msg : {bookkey: bookkey}}, '*');		
	};
	tsoc_o.clearPenTool = function() {
		console.log("tsoc_o.clearPenTool");
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'pen', info: {type: 'pen-clear'}}} , '*');	
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'menu', info: {type: 'setPointerMode'}}} , '*');	
	};
	tsoc_o.showMathKit = function(show){
		console.log("tsoc_o.showMathKit", show);
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalDisplay', msg: { to: 'menu', display: show }} , '*');	
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'pen', info: {type: 'showNote', data: show}}} , '*');	
	};
	tsoc_o.showLoading = function(show){
		console.log("tsoc_o.showLoading", show);
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'showLoading', msg: show} , '*');	
	};
	tsoc_o.alert = function(msg){
		console.log("tsoc_o.alert", msg);
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'alert', msg: msg} , '*');
	};
	///////////////////////////////////////////////////////////////////////
	tsoc_o.initComplete = function(callBack){
		_initCallBack = callBack;
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'init' }, '*');		
	}
	tsoc_o.getStudents = function(callBack){
		// console.log("tsoc_o.getStudents", callBack);
		_studentsCallBack = callBack;
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'getLoginStudentsProfile' }, '*');
	}
	
	tsoc_o.gotoPAD = function(url){

	};
	tsoc_o.sendAll = function(obj){
		if(obj) window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'broadcastMsgToStudents', msg:obj }, '*');
		else window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'broadcastMsgToStudents', msg:{} }, '*');
		//if(obj) alert("tsoc_o.sendAll" + JSON.stringify(obj));
	}
	tsoc_o.sendPADToID = function(id, obj){
		
		// console.log("tsoc_o.sendPADToID", id, obj);
		if(obj) window.top.postMessage({type: 'sendMsgToStudent', from: 'content', srcFrame: 'book', msg:{id:id, data:obj} }, '*');
		else window.top.postMessage({type: 'sendMsgToStudent', from: 'content', srcFrame: 'book', msg:{id:id, data:{}} }, '*');
		//if(obj) alert("tsoc_o.sendAll" + JSON.stringify(obj));
	}
	
	tsoc_o.sendTeacher = function(obj){

	}

	tsoc_o.hideTitleBar = function(){
		window.top.postMessage({ type: 'hideContentToolTitlebar', from: 'content', srcFrame: 'book', }, '*');
	}
	tsoc_o.showTitleBar = function(){
		window.top.postMessage({ type: 'showContentToolTitlebar', from: 'content', srcFrame: 'book', }, '*');
	}	
	tsoc_o.setTitleBar = function(data){}
	tsoc_o.gotoNextBook = function(){
		window.top.postMessage({ type: 'moveNextContent', from: 'content', srcFrame: 'book', }, '*');
	};
	tsoc_o.gotoPrevBook = function(){
		window.top.postMessage({ type: 'movePrevContent', from: 'content', srcFrame: 'book', }, '*');
	};
	
	tsoc_o.getPreviewResult = function(callBack, msg){
		_previewCallBack = callBack;
		try{
			window.top.postMessage({ type: 'getPreviewResult', from: 'content', srcFrame: 'book', msg: msg }, '*');
		}catch(e){
			callBack.call(null, []);
			_previewCallBack = null;
		}
	};
	tsoc_o.getPreviewDmsResult = function(callBack, msg){
		_previewCallBack = callBack;
		try{
			window.top.postMessage({ type: 'getPreviewDmsResult', from: 'content', srcFrame: 'book', msg: msg }, '*');
		}catch(e){
			callBack.call(null, []);
			_previewCallBack = null;
		}
	};

	tsoc_o.startStudentReportProcess = function(nType, students, viewType){
		if(viewType) {
			if(students) window.top.postMessage({ type: 'startStudentReportProcess', msg: { type: nType, viewType: viewType, data : {studentIdList:students} }, from: 'content', srcFrame: 'book'}, '*');
			else window.top.postMessage({ type: 'startStudentReportProcess', msg: { type: nType, viewType: viewType }, from: 'content', srcFrame: 'book'}, '*');
		} else {
			if(students) window.top.postMessage({ type: 'startStudentReportProcess', msg: { type: nType, data : {studentIdList:students} }, from: 'content', srcFrame: 'book'}, '*');
			else window.top.postMessage({ type: 'startStudentReportProcess', msg: { type: nType}, from: 'content', srcFrame: 'book'}, '*');
		}
	};

	tsoc_o.showStudentReportListPage = function(){
		window.top.postMessage({ type: 'showStudentReportListPage', from: 'content', srcFrame: 'book'}, '*');
	};
	tsoc_o.hideStudentReportListPage = function(){
		window.top.postMessage({ type: 'hideStudentReportListPage', from: 'content', srcFrame: 'book'}, '*');
	};

	tsoc_o.hideStudentReportUI = function(){
		// console.log("mm->tsoc_o.hideStudentReportUI");	
		window.top.postMessage({ type: 'hideStudentReportUI', from: 'content', srcFrame: 'book'}, '*');
	}
	tsoc_o.showStudentReportUI	= function(){
		// console.log("mm->tsoc_o.hideStudentReportUI");	
		window.top.postMessage({ type: 'showStudentReportUI', from: 'content', srcFrame: 'book'}, '*');
    }
    tsoc_o.uploadInclassReport = function(obj){
		window.top.postMessage({type: 'uploadInclassReport', msg: obj, from: 'content', srcFrame: 'book'}, '*')
	}
	tsoc_o.finishContentPage = function() {
		window.top.postMessage({ type: 'finishContentPage', from: 'content', srcFrame: 'book'}, '*');
	}
    tsoc_o.addStudentForStudentReportType6 = function(studentid){
		window.top.postMessage({ type: 'addStudentForStudentReportType6',  msg: { studentId: studentid }, from: 'content', srcFrame: 'book'}, '*');
	};
	tsoc_o.showLoading = function(show){
		console.log("tsoc_o.showLoading", show);
		window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'showLoading', msg: show} , '*');	
	};
	window.addEventListener('message', handlePostMessage);
	
	function handlePostMessage(evt) {
		var data = evt.data;
		console.log("book handlePostMessage", data);
		// alert(JSON.stringify(data));
		// console.log(data.from, data.type, JSON.stringify(data));
		if(data.from=="launcher"){
			if(data.type=="notifyStartContent" && _initCallBack){
				var step;
				var lesson;
				var contentStartType; // 
				var addOnHost = '';
				if(data.msg){
					step = data.msg.step;
					lesson = data.msg.lesson;
					if(data.msg.contentStartType) contentStartType = data.msg.contentStartType;
					if(data.msg.addOnHost) addOnHost = data.msg.addOnHost;
					console.log("book data.msg.preview", data.msg.preview);
					if(data.msg.preview) {
						step = undefined;
						lesson = undefined;
					}
				}
				console.log("notifyStartContent", step, lesson);
				_initCallBack.call(null, step, lesson, addOnHost);
				_initCallBack = null;
			}else if(data.type=="notifyLoginStudentsProfile" && _studentsCallBack){
				// console.log("handlePostMessage-->notifyLoginStudentsProfile", data);
				_studentsCallBack.call(null, data.msg, true);
				_studentsCallBack = null;
			}else if(data.type=="notifyReceiveMsg"){
				//alert("aaaaaaaa" + app_o + "," + app_o.receive);
				app_o.receive(data.msg);
			}else if(data.type=="notifyPreviewResult" && _previewCallBack){
				//alert("aaaaaaaa" + app_o + "," + app_o.receive);
				//app_o.receive(data.msg);
				// console.log("aaaaaaa", data);
				_previewCallBack.call(null, data.msg);
				_previewCallBack = null;
			}else if(data.type=="notifyPreviewDmsResult" && _previewCallBack){
				//alert("aaaaaaaa" + app_o + "," + app_o.receive);
				//app_o.receive(data.msg);
				// console.log("aaaaaaa", data);
				_previewCallBack.call(null, data.msg);
				_previewCallBack = null;
			}else if(data.type=="notifyStartTeachingTool"){
				app_o.teachingTool(true);
			}else if(data.type=="notifyFinishTeachingTool"){
				app_o.teachingTool(false);
			}else if(data.type=="notifyUploadInclassReportResult"){
				app_o.receive(data.msg);
				// console.log('notifyUploadInclassReportResult: ', data.msg.result)
			}else if(data.type=="notifyBookCaptureInfo"){
				console.log('notifyBookCaptureInfo: ', data.msg);
				app_o.notifyBookCaptureInfo(data.msg);
			}else if(data.type=="notifyUploadToServerResult"){
				console.log("notifyUploadToServerResult" + JSON.stringify(data.msg));
				if(data.msg && data.msg.result=="success"){
					app_o.notifyUploadToServerResult(data.msg.url);
				}else{
					app_o.notifyUploadToServerResult(null);
				}
			}else if(data.type=="notifyAlert") {
				app_o.notifyAlert(data.msg.isOk);
			}
		} else if(data.from=="content"){ 
			if(data.type=='internalMsg') {
				console.log("================>> internalMsg",data.msg.info.type)
				if(data.msg.subType=='notifyNaviInfo') {
					const info = data.msg.info;
					console.log("book handlePostMessage notifyNaviInfo", info);
					app_o.notifyNaviInfo(info.curriculum, info.bookid, info.classid, info.unitid, info.lessonid, info.curriType);
				}
				if(data.msg.info.type === "notifyPenToolState") {
					console.log("~~~~~~~~~~~~~~~~~~~~!!!!!!!!!!!!!!!!!!!!NotifyPenToolState")
					app_o.notifyPenToolState(data.msg.info.data.isVisible,data.msg.info.data.height);
				}
				if(data.msg.subType === "notifyHamburgerMenuClicked") {
					console.log("~~~~~~~~~~~~~~~~~~~~!!!!!!!!!!!!!!!!!!!!notifyHamburgerMenuClicked")
					console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~",data.msg.info.isVisible);
					app_o.notifyHamburgerMenuClicked(data.msg.info.isVisible);
				}
			} 
		} else if(data.from =="macontent") {
			console.log("msg",data.type);
			
			if(data.type === "callThreeminState") {
				app_o.callThreeminState();
			}
		}
		/*
		  const data = evt.data;
		  if (handler[data.type]) {
			handler[data.type](data.msg);
		  }
		 */
	}

	window.tsoc_o = tsoc_o;
})(window.comm_o, window.app_o);