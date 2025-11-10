(function(comm_o, app_o){
	if(window.psoc_o) return;
	
	var psoc_o = {};
	
	psoc_o.isInited = false;
	psoc_o.popupIdx = -1;
	

		
	if(comm_o.isDvlp){
		psoc_o.initCompleted = function(){
			psoc_o.isInited  =true;
		};
		psoc_o.disableSoftwareKeyboard = function(){

		};
		
		psoc_o.startVoiceRecord = function(){
			app_o.notifyStartVoice();			
		};
		
		var _sampleIdx = 0;
		psoc_o.stopVoiceRecord = function(){
			var idx = _sampleIdx%3;
			app_o.notifyVoiceRecordResult("/content/sample/sample_"+idx+".mp3");	
			
			_sampleIdx++;
		};
		
		psoc_o.uploadFileToServer = function(deviceUrl){
			app_o.notifyUploadToServerResult(deviceUrl);
        };
        psoc_o.uploadImageToServer = function(base64, mixPen, rect, save){
			console.log("psoc_o.uploadImageToServer", mixPen, rect, save);
			app_o.notifyUploadToServerResult(base64);
		};
		
		var _openerDoc = null;
		var _openerUnload = null;
		var _checkOpener = null;
		_openerUnload = function(){
			window.opener.removeEventListener("beforeunload", _openerUnload);
			window.requestAnimationFrame(_checkOpener);
		};
		
		_checkOpener = function(t){
			if(window.opener==null || window.opener.closed){
				window.close();
				return;
			}else{
				var odoc = window.opener.document;
				
				
				if(odoc && _openerDoc!=odoc && (odoc.readyState=="interactive" || odoc.readyState=="complete")){
					
					_openerDoc = odoc;
					var opr = window.opener;
					
					
					if(opr.tsoc_o){
						opr.tsoc_o.addPopup(window);
						psoc_o.popupIdx = opr.tsoc_o.getPopupIdx(window);
					}else{
						if(!opr.pads) opr.pads=[];
								
						if(opr.pads.indexOf(window)<0){
							opr.pads.push(window);
						}
					}
					window.opener.addEventListener("beforeunload", _openerUnload);
					return;
				}
			}
			window.requestAnimationFrame(_checkOpener);
		};
		window.requestAnimationFrame(_checkOpener);
		
		window.addEventListener("beforeunload", function(){
			if(window.opener){
				window.opener.removeEventListener("beforeunload", _openerUnload);	
			}
		});
		window.addEventListener("unload", function(){
			if(window.opener){
				window.opener.removeEventListener("beforeunload", _openerUnload);	
			}
		});
	}else{
		var _initCallBack = null;
		var _myProfileCallBack = null;
		psoc_o.disableSoftwareKeyboard = function(){
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'disableSoftwareKeyboard' }, '*');
		};
		
		psoc_o.initCompleted = function(callBack){
			_initCallBack = callBack;
			
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'init' }, '*');
		};
		psoc_o.myProfile = function(callBack){
			_myProfileCallBack = callBack;
			
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'getMyProfile' }, '*');
		};
		psoc_o.sendTeacher = function(obj){
			// console.log("psoc_o.sendTeacher", obj);
			// console.log("sendTeacher", JSON.stringify(obj));
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'sendMsgToTeacher', msg:obj }, '*');
		};
		psoc_o.startVoiceRecord = function(){
			// console.log("psoc_o.startVoiceRecord");
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'startVoiceRecord'}, '*');			
		};
		psoc_o.stopVoiceRecord = function(){
			// console.log("psoc_o.stopVoiceRecord");
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'stopVoiceRecord'}, '*');			
		};
		
		psoc_o.uploadFileToServer = function(deviceUrl){
			// console.log("psoc_o.uploadFileToServer");
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'uploadFileToServer', msg : {url : deviceUrl}}, '*');		
		};
		psoc_o.uploadImageToServer = function(base64, mixPen, rect, save){
			console.log("psoc_o.uploadImageToServer", mixPen, rect, save);
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'uploadImageToServer', msg : {src : base64, mixPen: mixPen, rect: rect, save: save}}, '*');	
		};
		psoc_o.uploadFileToServerMulti = function(deviceUrl){
			console.log('uploadFileToServerMulti deviceUrl', deviceUrl);
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'uploadFileToServerMulti', msg : deviceUrl}, '*');		
		};
		
		psoc_o.uploadStudentReport = function(nType, sData, sOption){
			// console.log("psoc_o.uploadStudentReport", nType, sData, sOption);
			window.parent.postMessage({ srcFrame: 'book', type: 'uploadStudentReport', msg: { srcFrame: 'book', type: nType, data: {value: sData, option: sOption} }, from: 'content' }, '*');
		};

		psoc_o.startCamera = function(back){
			if(back) window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'startCamera', msg: back }, '*');
			else window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'startCamera' }, '*');
		};

		psoc_o.startCustomCamera = function(rect){
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'startCustomCamera', msg: rect }, '*');
		};

		psoc_o.stopCamera = function(){
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'stopCamera' }, '*');
		};

		psoc_o.switchCamera = function(doswitch){
			if(doswitch) window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'switchCamera', msg: doswitch }, '*');
			else window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'switchCamera' }, '*');
		};
		psoc_o.startVideoRecord = function() {
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'startVideoRecord' }, '*');
		};
		psoc_o.stopVideoRecord = function() {
			window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'stopVideoRecord' }, '*');
		};
        psoc_o.takePicture = function(rect) {
            window.parent.postMessage({ from: 'content', srcFrame: 'book', type: 'takePicture', msg: rect }, '*');
		};
		///////////////////////////////////////////////////////////////////////
		psoc_o.clearPenTool = function() {
			console.log("psoc_o.clearPenTool");
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'pen', info: {type: 'pen-clear'}}}, '*');	
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'menu', info: {type: 'setPointerMode'}}}, '*');	
		};
		psoc_o.showSendButton = function(show,isup) {
			console.log("psoc_o.showSendButton show: %s isup: %s",show,isup);
			let bottom = 86;
			if(isup !== undefined) {
				if(isup) {
					bottom = 86;
				} else {
					bottom = 9
				}
			}
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'showSendButton', msg: {view:show, bottom: bottom}}, '*');	
		};// 런처의 Send Button 을 부른다  bottom 값에 따라 position 이 달라짐 
		psoc_o.showMathKit = function(show){// 펜툴및 메뉴 를 숨기거나 보여줌 - 펜툴을 사용한 기록은 남아 있음 by 김성준 
			console.log("psoc_o.showMathKit");
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalDisplay', msg: { to: 'menu', display: show }} , '*');
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalDisplay', msg: { to: 'teaching', display: show }} , '*');
			// window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'pen', info: {type: 'showNote', data: show}}} , '*');	
		};
		psoc_o.showRecordTool = function(show) {
			console.log("psoc_o.showRecordTool");
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'showRecordTool', msg: show}, '*');	
		};
		psoc_o.showLoading = function(show){
			console.log("psoc_o.showLoading", show);
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'showLoading', msg: show} , '*');	
		};
		psoc_o.alert = function(msg){
			console.log("psoc_o.alert", msg);
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'alert', msg: msg} , '*');
		};
		///////////////////////////////////////////////////////////////////////
		psoc_o.showPenTool = function() {
			console.log("psoc_o.showPenTool")
			let msg ={
				to: 'teaching',
                info: {
                    type: 'startBasicPenTool',
                    data: undefined
                },
			}
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg:msg} , '*');
		}// 2021 03 31 새로운 펜툴 불러오기 성준 추가
		psoc_o.hidePenTool = function() {
			console.log("psoc_o.showPenTool")
			let msg ={
				to: 'teaching',
                info: {
                    type: 'stopBasicPenTool',
                    data: undefined
                },
			}
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg:msg} , '*');
		}// 2021 03 31 새로운 펜툴 불러오기 성준 추가
		psoc_o.clearPenTool = function() {
			console.log("psoc_o.clearPenTool")
			let msg ={
				to: 'teaching',
                info: {
                    type: 'stopBasicPenTool',
                    data: undefined
                },
			}
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg:msg} , '*');
		}// 2021 03 31 새로운 펜툴 불러오기 성준 추가	
		psoc_o.launchTool = function(conceptKey){
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'launchTool', msg: conceptKey}, '*');
		};// 2021 07 23 launchTool 선생님/학생 구분으로 추가
		psoc_o.showLivePointPop = function(isVisibleHeart) {
			console.log('psoc_o showLivePointPop',isVisibleHeart)
			let msg ={
				to: 'menu',
                info: {
                    type: 'notifyChangeLivePoint',
					data:{isVisibleHeart: isVisibleHeart}
                },
			}
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalDisplay', msg: { to: 'menu', display: true }} , '*');// 메뉴 창이 hidden 일 상태에서 호출되는 것을 방지 하기 위해 추가 
			setTimeout(() => {
				window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg:msg} , '*');
			},300)
			
		}// 2021 08 04 Live Point 보여주는 좌측 하단 팝업 호출 
		psoc_o.showGiftBox = function(livepoint, colorType) {
			console.log('psoc_o showGiftBox live:',livepoint); 
			window.top.postMessage({ from: 'content', srcFrame: 'book', type: 'internalMsg', msg: { to: 'menu',info: {type:'notifyLiveGive',data:{live: livepoint, liveType: colorType}} }} , '*');
		}// 2021 08 31 Green Live Point 받는 선물 박스 호출

		window.addEventListener('message', handlePostMessage);
		
		function handlePostMessage(evt) {
			var data = evt.data;
			console.log("handlePostMessage", data.type, data.msg);
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
						if(data.msg.preview) {
							step = undefined;
							lesson = undefined;
						}
					}
					_initCallBack.call(null, step, lesson, addOnHost);
					_initCallBack = null;
				}else if(data.type=="notifyMyProfile" && _myProfileCallBack){
					_myProfileCallBack.call(null, data.msg);
					_myProfileCallBack = null;
				}else if(data.type=="notifyReceiveMsg"){
					app_o.receive(data.msg);
				}else if(data.type=="notifyStartVoice"){
					// console.log("notifyStartVoice" + JSON.stringify(data.msg));
					if(data.msg && data.msg.result=="success") app_o.notifyStartVoice();
				}else if(data.type=="notifyVoiceRecordResult"){
					// console.log("notifyVoiceRecordResult" + JSON.stringify(data.msg));
					if(data.msg && data.msg.result=="success"){
						app_o.notifyVoiceRecordResult(data.msg.url);
					}else{
						app_o.notifyVoiceRecordResult(null);
					}
				}else if(data.type=="notifyUploadToServerResult"){
					console.log("notifyUploadToServerResult" + JSON.stringify(data.msg));
					if(data.msg && data.msg.result=="success"){
						app_o.notifyUploadToServerResult(data.msg.url);
					}else{
						app_o.notifyUploadToServerResult(null);
					}
				}else if(data.type=="notifyUploadToServerMultiResult"){
					console.log("notifyUploadToServerMultiResult" + JSON.stringify(data.msg));
					app_o.notifyUploadToServerMultiResult(data.msg);
				}else if (data.type=="notifyStartCamera") {
					app_o.notify(data.type);
					if(data.msg && data.msg.result=="success") app_o.notify(data.type);
					else app_o.notify('notifyNoCamera')
				}else if(
					data.type=="notifyStopCamera" || 
					data.type=="notifySwitchCamera" || 
					data.type=="notifyStartVideoRecord" || 
					data.type=="notifyVideoRecordCanceled"
				){
					app_o.notify(data.type);
				}else if(data.type=="notifyVideoRecordResult"){
					// console.log("notifyVideoRecordResult" + JSON.stringify(data.msg));
					if(data.msg && data.msg.result=="success"){
						// console.log("=========================>app_o.notifyVideoRecord", data.msg.url);
						app_o.notifyVideoRecord(data.msg.url);
					}else{
						app_o.notify('notifyStopVideoRecord');
					}
				}else if(data.type=="notifyTakePicture") {
					if(data.msg && data.msg.result=="success") {
						app_o.notifyTakePicture(data.msg.url, data.msg.src);
					}
				}else if(data.type=="clickSendButton") {
					app_o.clickSendButton();
				}else if(data.type=="notifyRecordData") {
					console.log("notifyRecordData" + JSON.stringify(data.msg));
					app_o.notifyRecordData(data.msg.audio, data.msg.data);
				}else if(data.type=="notifyAlert") {
					app_o.notifyAlert(data.msg.isOk);
				}
			} else if(data.type === 'internalMsg') {
				if(data.msg.info.type === "notifyPenToolState") {
					app_o.notifyPenToolState(data.msg.info.data.isVisible,data.msg.info.data.height);
				} else if(data.msg.info.type === 'notifyLiveGivePopupClose') {
					app_o.notifyLiveGivePopupClose();
				}
			} else if(data.from=="content"){ 
				//
			}
			/*
				const data = evt.data;
				if (handler[data.type]) {
				handler[data.type](data.msg);
				}
				*/
		}
	}
	window.psoc_o = psoc_o;
})(window.comm_o, window.app_o);