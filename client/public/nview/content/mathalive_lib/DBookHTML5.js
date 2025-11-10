var e_o;
var e_spage;
(function(){
	if(e_o) return; 
	e_o = {};

	var _browser = (function(ua){
		ua = ua.toLowerCase();
		var match = /(edge)\/([\w.]+)/.exec( ua ) || /(opr)[\/]([\w.]+)/.exec( ua ) || /(chrome)[ \/]([\w.]+)/.exec( ua ) || /(version)(applewebkit)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec( ua ) || /(webkit)[ \/]([\w.]+).*(version)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec( ua ) || /(webkit)[ \/]([\w.]+)/.exec( ua ) || /(opera)(?:.*version|)[ \/]([\w.]+)/.exec( ua ) || /(msie) ([\w.]+)/.exec( ua ) || ua.indexOf("trident") >= 0 && /(rv)(?::| )([\w.]+)/.exec( ua ) || ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec( ua ) || [];
		var platform_match = /(ipad)/.exec( ua ) || /(ipod)/.exec( ua ) || /(iphone)/.exec( ua ) || /(kindle)/.exec( ua ) || /(silk)/.exec( ua ) || /(android)/.exec( ua ) || /(windows phone)/.exec( ua ) || /(win)/.exec( ua ) || /(mac)/.exec( ua ) || /(linux)/.exec( ua ) || /(cros)/.exec( ua ) || /(playbook)/.exec( ua ) || /(bb)/.exec( ua ) || /(blackberry)/.exec( ua ) || [];
		var browser = {};
		var matched = {
			browser: match[ 5 ] || match[ 3 ] || match[ 1 ] || "",
			version: match[ 2 ] || match[ 4 ] || "0",
			versionNumber: match[ 4 ] || match[ 2 ] || "0",
			platform: platform_match[ 0 ] || ""
		};
		if ( matched.browser ) {
			browser[ matched.browser ] = true;
			browser.version = matched.version;
			browser.versionNumber = parseInt(matched.versionNumber, 10);
		}
		if ( matched.platform ) {
			browser[ matched.platform ] = true;
		}
		if ( browser.android || browser.bb || browser.blackberry || browser.ipad || browser.iphone || browser.ipod || browser.kindle || browser.playbook || browser.silk || browser[ "windows phone" ]) {
			browser.mobile = true;
		}
		if (browser.ipad || browser.iphone || browser.ipod){
			browser.ios = true;
		}
		if ( browser.safari && browser.android ) {
			matched.browser = "android";
			browser["android"] = true;
		}
		browser.name = matched.browser;
		browser.platform = matched.platform;
		return browser;
	})(navigator.userAgent||navigator.vendor||window.opera);
	
	var _isMobile = _browser.mobile;

	var _dbook = null;
	var _dbookRect = null;
	var _arrRequestVar = new Array();
	var _arrEvent = new Array();
	

	e_o.dbookID = "dBook";
	e_o.initStart = function(){
		e_dpage=e_o.getRequestVar("dpage");
		e_spage=parseInt(e_o.getRequestVar("rpage"));
		if(isNaN(e_spage) || e_spage<=0){
			e_spage=parseInt(e_o.getRequestVar("startpage"));
			
			if(isNaN(e_spage) || e_spage<=0) e_spage=1;
			else{
				e_spage=e_spage-e_pageFix;
				if(e_isDoublePage && e_isOneImgTwoPage) e_spage=(e_bCoverSlide)?Math.ceil((e_spage+1)/2):Math.ceil(e_spage/2);
				
				if(e_spage<=0) e_spage=1;
			}
		}
		
		if(!_dbook){
			_dbook = document.getElementById(e_o.dbookID);
			e_o.dbook = _dbook;
		}
		if(!_dbook) return;
		
		if(_isMobile){
			//document.body.requestFullScreen();
		}else{
			_dbook.addEventListener("contextmenu", function(evt){
				evt.preventDefault();
			});
		}

		var absHref = document.location.href;
		absHref = absHref.replace("\\", "/");
		if (absHref.lastIndexOf("/") >= 0) {
			absHref = absHref.substring(0, 	absHref.lastIndexOf("/") + 1);
		}
		
		var nStart = absHref.indexOf("/", absHref.indexOf('://')+3);
		
		hostURL = absHref;
		if (nStart >= 0) {
			hostURL = absHref.substring(0, 	nStart);
		}		
		var absURL = window.e_absURL;
		
		
		if(typeof(absURL)==="undefined"){
			absURL = absHref.substring(nStart);
		}else{
			absHref = hostURL + absURL;
		}
		_dbook.handle_loadDBook(hostURL, absURL, _isMobile, e_o.dbookID, "./js/arr2bmp.js");
	};

	
	e_o.initEnd = function(){
		_dispatchEvent("initEnd");
		
	};
	e_o.notSupport = function(){
		_dispatchEvent("notSupport");
	};
	e_o.endInitLink = function(){
		_dispatchEvent("endInitLink");
	};
	e_o.mouseDown = function(x, y, button){
		_dispatchEvent("mouseDown", x, y, button);
	};
	e_o.mouseUp = function(x, y, button){
		_dispatchEvent("mouseUp", x, y, button);	
	};
	e_o.startFlip = function(){
		_dispatchEvent("startFlip");
	};
	e_o.endFlip = function(){
		_dispatchEvent("endFlip");
	};
	e_o.resize = function(){
		_dispatchEvent("resize");
	};	
	e_o.stageResize = function(){
		_dispatchEvent("stageResize");
	}
	e_o.getDBookValue = function(val){
		var ret="";
		try{ret=eval(val);}catch(e){}
		return ret;
	};
	
	function _getEvtLsnrIdx(name,func){
		for(var i=0; i<_arrEvent.length;i++){
			var oEvt = _arrEvent[i];
			if(oEvt.name==name.toLowerCase() && oEvt.func==func) return i;
		}
		return -1;
	};
	function _dispatchEvent(){
		var args = _dispatchEvent.arguments;
		var name = args[0].toLowerCase();
		var arr=new Array();
		var sArg="";
		for(var i=1;i<args.length;i++){
			arr.push(args[i]);
			sArg += "'" + args[i] + "'"
			if(i<args.length-1) sArg += ",";
		}
		for(var i=0; i<_arrEvent.length;i++){
			var oEvt = _arrEvent[i];
			if(oEvt.name==name){
				if(typeof(oEvt.func)=="function" || typeof(oEvt.func)=="object"){
					try{oEvt.func.apply(oEvt.obj, arr);}catch(e){}
				}
			}
		}
	};
	e_o.addEventListener = function(name,func, obj){
		if(_getEvtLsnrIdx(name,func)<0){
			var oEvent ={name:name.toLowerCase(),func:func,obj:obj};
			_arrEvent.push(oEvent);
		}		
	};
	e_o.removeEventListener = function(name,func){
		var idx=_getEvtLsnrIdx(name,func);
		if(idx>=0){
			var arrPre = _arrEvent.slice(0, idx);
			var arrNext = _arrEvent.slice(idx+1,_arrEvent.length);
			_arrEvent = arrPre.concat(arrNext);
		}		
	};

	
	e_o.getRequestVar = function(name){
		var ret="";
		var sName = name.toLowerCase();
		for(var i=0;i<_arrRequestVar.length;i++){
			if(sName=="startpage"){
				if( _arrRequestVar[i].name=="startpage" ||  _arrRequestVar[i].name=="page"){
					ret = _arrRequestVar[i].value;
					break;
				}else if(_arrRequestVar[i].name=="rpage"){
					try{
						ret=parseInt(_arrRequestVar[i].value)+ebook_getPageFix();
						break;
					}catch(e){break;}
				}
			}else if( _arrRequestVar[i].name==sName){
				ret = _arrRequestVar[i].value;
				break;
			}
		}
		return ret;
	};
	
	if( typeof(MSG_FRONT_PAGE)=="undefined" ) MSG_FRONT_PAGE="F";
	if( typeof(MSG_REAR_PAGE)=="undefined" ) MSG_REAR_PAGE="R";
	if( typeof(MSG_DPAGE_EXPRESSION)=="undefined" ) MSG_DPAGE_EXPRESSION="{L}-{R}/{T}";
	if( typeof(MSG_SPAGE_EXPRESSION)=="undefined" ) MSG_SPAGE_EXPRESSION="{P}/{T}";
	
	e_o.setViewPageInfo = function(obj, isDouble, isOld){
		var leftPage = obj.vitualPage_l;
		var rightPage = obj.vitualPage_r;
		if(isDouble){
			if(isOld){
				if(leftPage<=0) leftPage=MSG_REAR_PAGE;
				else leftPage=leftPage + "";
				
				if(rightPage<=0) rightPage=MSG_FRONT_PAGE;
				else rightPage=rightPage + "";
			}else{
				if(leftPage<=0) leftPage=MSG_FRONT_PAGE;
				else leftPage=leftPage + "";
				
				if(rightPage<=0) rightPage=MSG_REAR_PAGE;
				else rightPage=rightPage + "";
			}
		}else{
			if(isOld){
				if(leftPage<=0) leftPage=MSG_REAR_PAGE;
				else leftPage=leftPage + "";
			}else{
				if(leftPage<=0) leftPage=MSG_FRONT_PAGE;
				else leftPage=leftPage + "";
			}
		}
		obj.vitualPage_l_str = leftPage;
		obj.vitualPage_r_str = rightPage;
	}
	e_o.getViewPageStr = function(obj){
		if(!obj) obj = e_o.dbook.handle_getEBookVars(true);
		e_o.setViewPageInfo(obj, obj.e_isDoublePage, obj.e_isOldTurn);
		var leftPage = obj.vitualPage_l_str;
		var rightPage = obj.vitualPage_r_str;
		var totPage = obj.vitualTotalPage;		
		
		var pageStr;
		if(obj.e_isDoublePage){
			pageStr=MSG_DPAGE_EXPRESSION;
			pageStr=pageStr.replace("{L}", leftPage);
			pageStr=pageStr.replace("{R}", rightPage);
			pageStr=pageStr.replace("{T}", totPage);		
		}else{
			if(obj.e_isOldTurn){
				if(leftPage<=0) leftPage=MSG_REAR_PAGE;
				else leftPage=leftPage + "";
			}else{
				if(leftPage<=0) leftPage=MSG_FRONT_PAGE;
				else leftPage=leftPage + "";
			}
			pageStr=MSG_SPAGE_EXPRESSION;
			pageStr=pageStr.replace("{P}", leftPage);
			pageStr=pageStr.replace("{T}", totPage);	
		}
		return pageStr;
	};
	window.link_closeDBookZine = function(){
		var divID = "div_dbookzine";
		var frameID="frame_dbookzine";
		var oDiv = document.getElementById(divID);
		
		if(oDiv && oDiv.parentElement){
			oDiv.parentElement.removeChild(oDiv);
		}	
		
		var oFrame = document.getElementById(frameID);
		if(oFrame){
			oFrame.src="";
		}
	};
	e_o.linkClick = function(link){
		var type =  link.m_type;
		var href =  link.m_href;
		var target = link.m_target;
		if(type=="dbookzine"){
			var zineURL = e_absURL + "/zine";
			var divID = "div_dbookzine";
			var frameID="frame_dbookzine";
			var oDiv = document.getElementById(divID);
			var oFrame = document.getElementById(frameID);
			
			
			var isFirst = false;
			if(oDiv && oFrame){
				
			}else{
				oDiv = document.createElement("div");
				oDiv.id = divID;
				oDiv.name = divID;
				if(_browser.ios){
					//oDiv.style.overflowY = "scroll";
					e_o.getZineRect = function(){
						return {width:$(oDiv).width(), height:$(oDiv).height()};	
					};
				}
				oFrame = document.createElement("iframe");
				oFrame.id=frameID;
				oFrame.name=frameID;
				oFrame.frameBorder=0;
				oFrame.style.width="100%";
				oFrame.style.height="100%";	
				
				isFirst = true;
				oDiv.appendChild(oFrame);
				document.body.appendChild(oDiv);
			}
			oFrame.src= zineURL + "/view.html?news=" + href + "&app=dbook&isFirst=" + ((_browser.ios && isFirst)?"y":"n");
		}else if(type=="url" || type=="hotspot"){
			if(href.indexOf("javascript")==0){
				eval(href);
			}else if(href.indexOf("mailto:")==0){
				window.location.replace(href);
			}else{
				var obj = _dbook.handle_getEBookVars(false);
				
				var absHref = obj.e_absHref;
				
				if(href.indexOf("www.")==0)
					href="http://"+sHref;
				
				if(href.indexOf("://")<0 && absHref.indexOf("file")!=0) href=absHref+href;

				var oWin=window.open(href, target);
				try{ oWin.focus();}catch(e){
					window.location.href = href;
				}				
			}
		}else if(type=="mail"){
			if(href.indexOf("mailto:")!=0) href="mailto:"+href
			window.location.replace(href);			
		}else if(type=="dbook"){
			var arrHref=href.split("&");
			var objH=new Object();
			for(var i=0;i<arrHref.length;i++){
				var arr2=arrHref[i].split("=");
				if(arr2.length==2) objH[arr2[0]]=arr2[1];
			}
			var sHref=objH.url;
			if(typeof(g_dBookViewAspURL)!="undefined"){
					sHref=g_dBookViewAspURL.substring(0, g_dBookViewAspURL.indexOf("?"));
			}
			if(objH.seq && objH.path){
				sHref+="?seq="+objH.seq+"&path="+objH.path;
				if(objH.page) sHref+="&page="+objH.page;
				var w=window.screen.availWidth;
				var h=window.screen.availHeight;		
				
				var oWin=window.open(sHref, "dBookWin_"+objH.seq, "width="+w+",height="+h+",resizable=yes,scrollbars=no,menubar=no");
				try{ oWin.focus();}catch(e){
					window.location.href = sHref;
				}
			}
		}else if(info.type=="mailqna"){
			/* TO DO */	
		}
	};	
	
	(function(){
		var strHref=document.location.href;
		if(strHref.lastIndexOf("?")>0){
			strHref = strHref.substring( strHref.lastIndexOf("?")+1 );
			var arr_1 = strHref.split("&");
			for(var i=0; i<arr_1.length;i++){
				var arr_2 = arr_1[i].split("=");
				if(arr_2.length==2){
					var oParam = {name:arr_2[0].toLowerCase(),value:arr_2[1]};
					_arrRequestVar.push(oParam);
				}
			}
		}
	})();
	e_o.browser = _browser;
})();
