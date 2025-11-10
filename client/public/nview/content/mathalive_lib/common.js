(function(){
	if(window.comm_o) return;
	var comm_o = {};
	var _isTest= true; //document.location.href.indexOf("kdmttest=y")>=0;
	var _isDvlp = true; //document.location.href.indexOf("kdmtdvlp=y")>=0;
	console.log(document.location.href, _isDvlp)
	var _displayMode = 2; //(document.location.href.indexOf("dmode=2")>=0) ? '2' : '1';
	
	comm_o.getQuery = function(key){
		var href = window.location.href;
		var arr = href.split("?");
		if(arr.length!=2) return null;
		
		var query = arr[1];
		arr = query.split("&");
		for(var i=0; i<arr.length; i++){
			var arr2 = arr[i].split("=");
			if(arr2.length==2 && arr2[0]==key) return arr2[1];
		}
		return null;
	};
	comm_o.addQuery = function(url, key, value){
		var query = key + "=" + encodeURIComponent(value);
		if(url.indexOf("?")>=0) url = url + "&" + query;
		else url = url + "?" + query;
		return url;
	};
	comm_o.isTest = _isTest;
	comm_o.isDvlp = _isDvlp;
	comm_o.displayMode = _displayMode;
	console.log(_isTest, _isDvlp, _displayMode)
	window.comm_o = comm_o;
})();