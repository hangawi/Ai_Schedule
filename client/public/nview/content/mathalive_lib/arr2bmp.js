 function  mybtoa(input){
	var keyStr="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	var cOut;
	var sOut="";
	var i=0;
	var len = input.length;
	while (i<len) {
		var chr1=input[i++];
		var chr2=input[i++];
		var chr3=input[i++];
		chr1=(isNaN(chr1))?0:chr1;
		chr2=(isNaN(chr2))?0:chr2;
		chr3=(isNaN(chr3))?0:chr3;
		var nGroup=0x10000*chr1+0x100*chr2 +chr3;
		var sGroup=nGroup.toString(8);
		if( sGroup.length<8){
			for(var j=sGroup.length;j<8;j++){
				sGroup="0"+sGroup;
			}
		}
		var pOut=keyStr.charAt(parseInt( sGroup.substr(0,2) ,8))+keyStr.charAt(parseInt( sGroup.substr(2,2) ,8))+keyStr.charAt(parseInt( sGroup.substr(4,2) ,8))+keyStr.charAt(parseInt( sGroup.substr(6,2) ,8));
		sOut=sOut+pOut;
	}
	if(len%3==1)  sOut=sOut.substr(0, sOut.length-2)+"==";
	else if(len%3==2)  sOut=sOut.substr(0, sOut.length-1)+"=";
	return sOut;
}
self.onmessage = (function(me){
	
	var limit = 0x8000;
		
	return function(e) {
		var unic = e.data.unic;
		var imgType = e.data.imgType;
		
		var u8arr = e.data.data;
		var base64 = '';
		if(me.btoa){
			
			var u8len = u8arr.length;
			var c = "";
			for (var i=0; i < u8len; i+=limit) {
				c += String.fromCharCode.apply(null, u8arr.subarray(i, i+limit));
			}
			base64 = me.btoa(c);
			/*
			if(u8len<limit){
				base64= btoa(String.fromCharCode.apply(null, u8arr));
			}else{
				var nS, nE;
				for(nS=0;nS<u8len;nS+=limit){
					nE=(nS+limit<u8len)?nS+limit:u8len;
					base64 += String.fromCharCode.apply(null,  u8arr.subarray(nS, nE));
				}
				base64 = btoa(base64);
			}
			*/
		}else{
			base64 = mybtoa(u8arr);
		}
		self.postMessage({ unic:unic, imgType:imgType, data:base64 });
	};
})(this);


