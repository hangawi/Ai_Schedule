(function(comm_o){
	if(window.tsoc_o) return;
	var tsoc_o = {};
	
	var _isDvlp = comm_o.isDvlp;
	
	if(_isDvlp){
		var _popups = [];
		var _padURL = "";
		
		var _thumbs = [
			"/content/sample/male_01.png"
		,	"/content/sample/female_01.png"
		,	"/content/sample/female_02.png"
		,	"/content/sample/male_02.png"
		,	"/content/sample/male_03.png"
		,	"/content/sample/female_03.png"
		,	"/content/sample/male_04.png"
		,	"/content/sample/male_01.png"
		,	"/content/sample/female_04.png"
		,	"/content/sample/female_01.png"
		];
		var _avatars = [
			"/content/sample/user_none_01.png"
		,	"/content/sample/user_none_02.png"
		,	"/content/sample/user_none_02.png"
		,	"/content/sample/user_none_01.png"
		,	"/content/sample/user_none_01.png"
		,	"/content/sample/user_none_02.png"
		,	"/content/sample/user_none_01.png"
		,	"/content/sample/user_none_01.png"
		,	"/content/sample/user_none_02.png"
		,	"/content/sample/user_none_02.png"		
		];
		var _nicknames = [
			"nick_Olivia"
		,	"nick_Aiden"
		,	"nick_Kevin"
		,	"nick_Lisa"
		,	"nick_Irene"
		,	"nick_Ted"
		,	"nick_Helen"
		,	"nick_Kate"
		,	"nick_Blue"
		,	"nick_Ray"
		];
	
		tsoc_o.gotoBook = function(bookid, booklist){
			// 
		};
		tsoc_o.gotoBookByKey = function(bookkey){
			// 
		};
		tsoc_o.exitBook = function(){
			// 
		};
		tsoc_o.launchTool = function(conceptKey){
			// 
		};
		tsoc_o.launchPadTool = function(conceptKey){
			// 
		};
		tsoc_o.getNaviInfo = function(curriType){
			// 
		};
		tsoc_o.exitClass = function(){
			// 
		};
		tsoc_o.logOut = function(){
			// 
		};
		tsoc_o.useFractionBar = function(){
			// 
		};
		tsoc_o.getStudent = function(idx){
			var thumbIdx = idx % _thumbs.length;
			var avatarIdx = idx % _avatars.length;
			var nicknameIdx = idx % _nicknames.length;
			
			return {
				id : _popups[idx].name
			,	name : _popups[idx].name
			,	thumb : _thumbs[thumbIdx]
			,	avatar: _avatars[avatarIdx]
			,	nickname : _nicknames[nicknameIdx]
			,	displayMode : comm_o.displayMode
		};
      
		}
		tsoc_o.addPopup = function(win){
			// console.log("tsoc_o.addPopup", win);
			var ret = _popups.indexOf(win)<0;
			if(ret) _popups.push(win);
			if(_padURL!="") _goto(win, _padURL);
			return ret;
		};
		tsoc_o.getPopupIdx = function(win){
			return _popups.indexOf(win);
		};
		
		tsoc_o.gotoPAD = function(url){
			url = comm_o.addQuery(url, "kdmtdvlp", "y");
			url = comm_o.addQuery(url, "lang", "ko");
			url = comm_o.addQuery(url, "dmode", comm_o.displayMode);
			_padURL = url;
			for(var i=_popups.length-1; i>=0; i--){
				var pop = 	_popups[i];
				if(pop.closed){
					_popups.splice(i,1);
				}else{
					_goto(pop, _padURL);
				}
			}
		};
		tsoc_o.sendAll = function(obj){
			for(var i=_popups.length-1; i>=0; i--){
				var pop = 	_popups[i];
				if(pop.closed){
					_popups.splice(i,1);
				}else{
					try{
						pop.app_o.receive(obj);
					}catch(e){}
				}			
			}
		};
		tsoc_o.sendPADToID = function(id, obj){
			for(var i=_popups.length-1; i>=0; i--){
        var pop = 	_popups[i];
        if(pop.name === id) {
          if(pop.closed){
            _popups.splice(i,1);
          }else{
            try{
              pop.app_o.receive(obj);
            }catch(e){}
          }			
        }
			}
		};
		
		tsoc_o.sendTeacher = function(obj){
			// console.log("tsoc_o.sendTeacher", obj);
			var ifrm = document.getElementById("ifrm");
			ifrm.contentWindow.app_o.receive(obj);
		};
		tsoc_o.getStudents = function(callBack){
			var students = [];
			var isOk = true;
			for(var i=0; i<_popups.length; i++){
				var popup = _popups[i];
				if(!popup.psoc_o){
					isOk = false;
				}else if(!popup.psoc_o.isInited){
					isOk = false;							
				}else{
					students[i] = tsoc_o.getStudent(i);
				}
			}
			callBack.call(null, students, isOk);
		}
		
		var _goto = function(win, url){
			if(win.location.href.indexOf(url)!=0) win.location.href = url	
		};
		tsoc_o.popups = _popups;
	}
	tsoc_o.prevBook = null;
	tsoc_o.nextBook = null;
	window.tsoc_o = tsoc_o;
	// console.log("tsoc_o");
})(comm_o);