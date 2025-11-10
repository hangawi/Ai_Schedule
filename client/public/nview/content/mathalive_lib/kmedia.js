(function(){
"use strict";
if(typeof(window.kmedia)==='undefined'){
	function $extend(from, fields) {
		function Inherit() {} Inherit.prototype = from; var proto = new Inherit();
		for (var name in fields) proto[name] = fields[name];
		return proto;
	}

	var _kmedia = {};

	if(window.AndroidInterFace) window.useSoundApi = false;
	if(typeof window.useSoundApi ==="undefined") window.useSoundApi = true;

	/* KSound 관련된 변수 */
	var _ctx = null;
	var _empty = null;

	var _videos = {};
	var _isEnabled = false;
	var _UNLOAD = 0;
	var _INITED = 1;
	var _LOADING = 2;
	var _LOADERROR = 9;
	var _LOADED = 10;
	var _MPRState = null;
	var _isMobile = false;
	

	(function(a){
		_isMobile = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4));
	})(navigator.userAgent||navigator.vendor||window.opera);
	var _isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
	
	var _clearEndTimer = function(objK){
		if(objK instanceof _kmedia.KSound){
			if(objK._endTimer>0){
				clearTimeout(objK._endTimer);
				objK._endTimer =  -1;
			}
		}
	};
	var _onEnd = function(objK){
		_playEnd(objK);
	};	
	var _setPos = function(objK, time){
		objK._currentPos_abs = time;
		if(objK.onTimeChange){
			objK.onTimeChange.call(null);
		}
	};
	
	var _timerPos = function(objK){
		if(objK._timerID>0){
			var time = objK.currentTime_abs();
			_setPos(objK, time);
			if(objK._endTime_temp>0 && time>=objK._endTime_temp){
				_playEnd(objK);
			}else if(objK._endtime_init>0 && time>=objK._endtime_init){
				_playEnd(objK);
			}
			window.requestAnimationFrame(function(t){
				_timerPos(objK);
			});
		}
		
	};
	
	var _durationChanged = function(objK, maxtime){
		if(objK._endtime_init<=0 || objK._endtime>=maxtime){
			objK._endtime_init = -1;
			objK._endtime=maxtime;
		}
		if(objK._starttime>maxtime) objK._starttime=0;
		
		if(objK._inittime<objK._starttime) objK._inittime = objK._starttime;
		if(objK._endtime>0 && objK._inittime>objK._endtime) objK._inittime = objK._starttime;
		objK._maxtime = maxtime;
		
		if(objK.onDurationChange) objK.onDurationChange.call(null);
		//if(m_player) m_player.durationChanged();		
	};
	var _playEnd = function(objK) {
		_pauseMedia(objK);
		
		if(objK._loop_temp>=0){
			var endtime = (objK._endTime_temp>0)?objK._endTime_temp:objK._endtime;
			_setPos(objK, endtime);
			objK._loopCnt_temp++;
			if(objK._loop_temp==0 || objK._loop_temp>objK._loopCnt_temp){
				if(objK._startTime_temp<0) objK.seek(0);
				else objK.seek(objK._startTime_temp - objK._starttime);
			}else{
				if(objK._endTime_temp<=0){
					if(!objK._isPlayEnd){
						objK._isPlayEnd = true;
						if(objK.onPlayEnd_temp) objK.onPlayEnd_temp.call(null);
						if(objK.onPlayEnd) objK.onPlayEnd.call(null);
					}
				}else{
					if(objK.onPlayEnd_temp) objK.onPlayEnd_temp.call(null);
				}
				objK._bPlay = false;
				objK._startTime_temp = -1;
				objK._endTime_temp = -1;
				objK._loop_temp = -1;
				objK._loopCnt_temp = 0;				
			}
		}else{
			_setPos(objK, objK._endtime);
			
			if(!objK._isPlayEnd){
				if(objK.onPlayEnd) objK.onPlayEnd.call(null);
			}
			
			objK._loopCnt++;
			if(objK._loop==0 || objK._loop>objK._loopCnt){
				_playMedia(objK, 0);
			}else{
				objK._isPlayEnd = true;
				if(objK.onPlayComplete) objK.onPlayComplete.call(null);
				
			}
		}
	};
	var _setPlayState = function(objK, state){
		if(objK._playState==state){
			return;
		}
		var preState = objK._playState;
		if(	(		
				    preState==_MPRState.PLAYBACK_ERROR 
				|| preState==_MPRState.UNINITIALIZED
				|| preState==_MPRState.LOADING
			) && (
					state==_MPRState.PAUSED 
				|| state==_MPRState.PLAYING 
				|| state==_MPRState.BUFFERING
			)
		) return;
		objK._playState = state;

		if(state==_MPRState.LOAD_ERROR){
			objK._loadState = _LOADERROR;
		}else if(state==_MPRState.LOADING){
			objK._loadState = _LOADING;
		}else if(state==_MPRState.READY){
			objK._loadState = _LOADED;
		}
		if(state==_MPRState.PLAYING){
			if(objK._timerID<0){
				objK._timerID = 1;
				window.requestAnimationFrame(function(t){
					_timerPos(objK);
				});
			}
		}else{
			objK._timerID = -1;			
		}
		if(objK.onPlayState){
			objK.onPlayState.call(null, state, preState);
		}
	};
	
	var _playMedia = function(objK, stime){

		if( stime>(objK._endtime-objK._starttime) ) stime = 0;
			
		if(objK instanceof _kmedia.KSound){
			_clearSound(objK);
			objK._isPlayEnd = false;
			objK._bPlay = true;
			
			var volume = (objK._muted)?0:objK._volume;
			var seek = objK._starttime + stime;
			var duration = objK._endtime - stime;
			var timeout = Math.round( duration / Math.abs(objK._rate) );
			
			_setPos(objK, seek);
			objK._startTime_play = seek;
			var bufSrc = null;
			if(objK._audioEL){
				objK._audioEL.addEventListener ("ended", objK);
				if(objK._audioEL.currentTime != seek/1000) objK._audioEL.currentTime = seek/1000;
				try{
					if(objK._audioEL.paused) objK._audioEL.play();
				}catch(e){}
				_setPlayState(objK, _MPRState.PLAYING);
			}else{
				objK._startTime_ctx = Math.round(_ctx.currentTime * 1000);	

				if(!objK._gain){
					objK._gain = (typeof _ctx.createGain === 'undefined') ? _ctx.createGainNode() : _ctx.createGain();
					objK._gain.connect(_ctx.destination);	
				}		
				objK._gain.gain.value = volume;
			
				bufSrc = _ctx.createBufferSource();
				bufSrc.buffer = objK._buffer;
				bufSrc.connect(objK._gain);
				
				//objK._gain.connect(_ctx.destination);
				
				bufSrc.playbackRate.value = objK._rate;
				
				//alert(bufSrc.noteGrainOn + "||" + bufSrc.noteOn + "||" + bufSrc.start);
				if (typeof bufSrc.start === 'undefined') {
					bufSrc.noteGrainOn(0, seek/1000, duration/1000);
				} else {
					bufSrc.start(0, seek/1000, duration/1000);
				}
				objK._bufferSource = bufSrc;
				_setPlayState(objK, _MPRState.PLAYING);
				objK._endTimer = setTimeout(_playEnd.bind(null, objK), timeout);
			}
						

		}else{
			objK._isPlayEnd = false;
			objK._bPlay = true;
			var seek = (objK._starttime + stime)/1000;

			if(Math.round(objK.video.currentTime * 10) == Math.round(seek * 10)){
				_setPlayState(objK, _MPRState.PAUSED);
				if(objK.video.paused) objK.video.play();
			}else{
				_setPlayState(objK, _MPRState.BUFFERING);
				objK.video.currentTime = seek;
			}

		}
	}; // _playMedia
	var _pauseMedia = function(objK){
	 	if(objK instanceof _kmedia.KSound){
			objK._bPlay = false;
			_clearSound(objK);
			_setPlayState(objK, _MPRState.PAUSED);
		}else{
			if(objK.video && !objK.video.paused){
				objK.video.pause();
			}
		}
	 };
	 
	 var _clearSound = function(objK){
		_clearEndTimer(objK);
		if(objK._audioEL){
			objK._audioEL.removeEventListener ("ended", objK);
			try{
				if(!objK._audioEL.paused) objK._audioEL.pause();
			}catch(e){}
		}else{
			if(objK._bufferSource){
				objK._bufferSource.onended = null;
				if(objK._gain) objK._bufferSource.disconnect(objK._gain);
				else objK._bufferSource.disconnect(0);
				try{
					if (typeof  objK._bufferSource.stop === 'undefined') {
						objK._bufferSource.noteOff(0);
					} else {
						 objK._bufferSource.stop(0);
					}
				}catch(e){}
				
				try{
					objK._bufferSource.buffer = null;
				}catch(e){}
				objK._bufferSource = null;
			}
			if(objK._gain){
				objK._gain.disconnect(_ctx.destination);
				objK._gain = null;
			}
		}	 	 
	 };
	 
	var _stopMedia = function(objK){
	 	 if(objK instanceof _kmedia.KSound){
			_pauseMedia(objK);
			_setPos(objK, objK._starttime);
		}else{
		 	_setPos(objK, objK._starttime);	
		 	
			var curTime = objK._starttime/1000;
			if(curTime!=objK.video.currentTime){
				_setPlayState(objK, _MPRState.BUFFERING);
				objK.video.currentTime = curTime;
			}
			_pauseMedia(objK);			
		}
	 };
	var _seekMedia = function(objK, val) {
		_setPlayState(objK, _MPRState.BUFFERING);
		if(objK._isPlayEnd){
			if(val<0) val = 0;
			if(val>=objK.duration()) val=0;
			objK._isPlayEnd = false;
		}else{
			if(val<0){
				val = objK.currentTime_abs() - objK._starttime;
			}
			if(val<0) val = 0;
			else if(val>objK.duration()) val=objK.duration();
		}
		if(objK._loop_temp>=0 && (val + objK._starttime<objK._startTime_temp || (objK._endTime_temp>0 && val + objK._starttime>objK._endTime_temp))){
			objK._bGotoAndPlay = false;
			objK._startTime_temp = -1;
			objK._endTime_temp = -1;
			objK._loop_temp = -1;
			objK._loopCnt_temp = 0;
		}
		_setPos(objK, val + objK._starttime);	
		return val;		
	};
	
	var _KMedia = function(){
	};
	
	_KMedia.prototype = {
		_unic:"",
		getUnic:function(){return this._unic},
		_loadState:_UNLOAD,
		_playState:null,
		playState:function(){return this._playState},
		_isPlayEnd:false,	
		_bPlay:false,
		_seekTime:0,
		_loop:1,
		_loopCur:0,
		_inittime:0,
		_starttime:0,
		_endtime:0,
		_endtime_init:0,
		_maxtime:0,
		_bGotoAndPlay:false,
		_startTime_temp:-1,
		_endTime_temp:-1,
		_loop_temp:-1,
		_loopCnt_temp:0,
		_currentPos_abs:0,
		_chkTime:250,
		_timerID:-1,
		_url:null,
		getUrl:function(){return this._url},
		onPlayState:null,
		onPlayEnd:null,
		onPlayEnd_temp:null,
		onPlayComplete:null,
		onDurationChange:null,
		onTimeChange:null,
		bPlay:function(){return this._bPlay;},
		isEnable:function(){return _isEnabled;},
		isPlayEnd:function(){return this._isPlayEnd;},
		starttime:function(){return this._starttime;},
		endtime:function(){return this._endtime;},
		maxtime:function(){return this._maxtime;},
		duration:function(){return this._endtime - this._starttime;},
		currentTime_abs:function(){return 0;},
		currentTime:function(){return this.currentTime_abs() - this._starttime;},
		canPlay:function(){return this._maxtime>0;},
		canSeek:function(){return true;},
		getMuted:function(){return false;},
		setMuted:function(muted){return false;},
		getVolume:function(){return 1;},
		setVolume:function(val){return 1;},
		getRate:function(){return 1;},
		setRate:function(val){return 1;},
		setStartEndTime:function(inittime, starttime, endtime, loop){
			if (starttime < 0) starttime = 0;
			if (endtime < 0 || endtime < starttime) endtime = 0;
			var prePos = this.currentTime_abs();	
			this._endtime_init = endtime;
			if(inittime<starttime) inittime = starttime;
			if(endtime>0 && inittime>endtime) inittime = starttime;	
			
			this._inittime = inittime;
			this._starttime = starttime;
			this._endtime = endtime;
			this._loop = loop;
			if(this._maxtime>0){
				_durationChanged(this, this._maxtime);
				if(prePos<this._starttime || prePos>this._endtime){
					this.seek(0);
				}
			}	
		},
		setChkTime:function(time){
			this._chkTime = time;
		},
		start:function(){
			this._loopCnt = 0;
			
			this._bGotoAndPlay = false;
			this._startTime_temp = -1;
			this._endTime_temp = -1;
			this._loop_temp = -1;
			this._loopCnt_temp = 0;	
			this._bPlay = true;
			this.seek(this._inittime - this._starttime);
			return;
		},
		play:function(bInitTemp){
			if(bInitTemp){
				this._loopCnt = 0;
				this._bGotoAndPlay = false;
				this._startTime_temp = -1;
				this._endTime_temp = -1;
				this._loop_temp = -1;
				this._loopCnt_temp = 0;
			}
			this._bPlay=true;
			this.seek(-1);
			return;
			
		},
		seek:function(time){
			this._seekTime = time;
			if(this._loadState<_LOADING){
				this.load();
				return time;
			}
			if(this._loadState < _LOADED) return time;
			time = _seekMedia(this, time);
			
			if(time==this.duration() && this._maxtime>0){
				_playEnd(this);
				return;
			}
			if(this._bPlay){
				_playMedia(this, time);
			}else{
				if(this instanceof _kmedia.KVideo){
					var curTime = (time + this._starttime)/1000;
					if(Math.round(curTime*10)==Math.round(this.video.currentTime*10)){
						if(this.video.paused) _setPlayState(this, _MPRState.PAUSED);
						else this.video.pause();
					}else{
						_setPlayState(this, _MPRState.BUFFERING);
						this.video.currentTime = curTime;
					}
				}
				_setPos(this, time + this._starttime);
			}
			return time;
		},
		pause:function(){
			this._bPlay = false;
			if(!_isEnabled || this._loadState < _LOADED) return;
			
			this._currentPos_abs = this.currentTime_abs();
			_pauseMedia(this);
		},
		stop:function(){
			this._bPlay = false;
			this._bGotoAndPlay = false;
			if(!_isEnabled || this._loadState < _LOADED) return;
			_stopMedia(this);
		},
		gotoAndPlay:function(start, end, loop){
			this._startTime_temp = start;
			this._endTime_temp = end;

			this._loop_temp = loop;	
			if(!_isEnabled){
				this._bGotoAndPlay = true;
				return;

			}else if(this._loadState>=_INITED && this._loadState < _LOADING){
				this._bGotoAndPlay = true;
				this.load();
				return;
			}else if(this._loadState < _LOADED){
				this._bGotoAndPlay = true;
				return;				
			}
			this._bGotoAndPlay = false;
			
			if(start>=0){
				if(start - 100>this.duration()) start = -1;
				else start = start + this._starttime;
			}else start = -1;
			
			if(end>0){
				if(end - 100>=this.duration()) end = -1;
				else end = end + this._starttime;				
			}else end = -1;

			
			if((start<0 && end<0) || (start>=0 && end>=0 && start>=end)){
				this._startTime_temp = -1;
				this._endTime_temp = -1;
				this._loop_temp = -1;
				this._loopCnt_temp = 0;
			}else{
				this._startTime_temp = start;
				this._endTime_temp = end;
				this._loop_temp = loop;
				this._loopCnt_temp = 0;
				
				if(this._startTime_temp>=0){
					this._bPlay=true;
					this.seek(this._startTime_temp - this._starttime);
				}
			}			
			if(!this._bPlay){
				this._bPlay=true;
				this.seek(-1);				
			}
		},
		gotoAndStop:function(pos){
			this._bGotoAndPlay = false;
			this._startTime_temp = -1;
			this._endTime_temp = -1;
			this._loop_temp = -1;				
			this._bPlay = false;
			if(!_isEnabled || this._loadState < _LOADED){
				return;
			}
			
			if(pos<0 || pos>this.duration()){
				this.pause();	
			}else{
				if(this instanceof _kmedia.KSound){
					this.pause();
				}
				this.seek(pos);
			}
		},		
		init:function(url){},
		load:function(){
			if(this._loadState>=_LOADING) return;
			_setPlayState(this, _MPRState.LOADING);
		},
		destory:function(){
			this.stop();
			this._bPlay = false;
			this._bGotoAndPlay = false;
			this._startTime_temp = -1;
			this._endTime_temp = -1;
			this._loop_temp = -1;
			this._loadState = _UNLOAD;
			this._playState = _MPRState.UNINITIALIZED;
		}
	};
	/* -------------------------------------------------------------   Sound 시작 */
	(function(){
		var _audio = null;
		(function(){
			if(!window.useSoundApi){
				_isEnabled = true;
				_ctx = null;
				_empty = null;
				return;
			}
			try{
				_ctx = (window.AudioContext)?new AudioContext():new webkitAudioContext();
				_empty = _ctx.createBuffer(1, 1, _ctx.sampleRate);
			}catch(e){}
			var unlock = function() {
				if(_isEnabled) return;
				if(_audio.paused){
					_audio.play();
				}
				if(source.playbackState==source.SCHEDULED_STATE || source.playbackState==source.UNSCHEDULED_STATE){
					try{
						source.start(0);
					}catch(e){
						return;
					}
				}
				setTimeout(checkEnable, 0);
			};
			_kmedia.unlock = unlock;
			
			var setEnable = function(){
				if(_isEnabled)  return;
				
				_isEnabled = true;
				if(_audio){
					_audio.removeEventListener ("playing", setEnable);
					_audio.removeEventListener ("ended", setEnable);
					if(!_audio.paused) _audio.pause();
				}
				document.removeEventListener('touchstart', unlock, true);	
				document.removeEventListener('touchend', unlock, true);
				_audio = null;
			};
	
			_kmedia.setEnable = setEnable;
			
				
			if(!_ctx || _isEnabled || !_isIOS){
				_isEnabled = true;
				return;
			}
			
			_audio = document.createElement ("audio");
			_audio.controls = false;
			_audio.autoplay = false;
			_audio.preload = "auto";
			
			
			var source = _ctx.createBufferSource();
			source.buffer = _empty;
			source.connect(_ctx.destination);
			var checkEnable = function(){
				if ((source.playbackState === source.PLAYING_STATE || source.playbackState === source.FINISHED_STATE)) {
					setEnable();
				}
			};

			
			_audio.addEventListener ("playing", setEnable);
			_audio.addEventListener ("ended", setEnable);
	
			document.addEventListener('touchstart', unlock, true);	
			document.addEventListener('touchend', unlock, true);	
		})();
		_kmedia.init = function(url){
			if(!_audio){
				return;
			}
			_audio.src = url;
			_audio.load();
		};		
		
		var _KSound = function(MPRState){
			_MPRState = MPRState;
			_KMedia.call(this);

			this._unic = (new Date()).getTime().toString(36);
			this._playState = _MPRState.UNINITIALIZED;
			
			this._gain = null;
			this._bufferSource = null;
			this._startTime_play = 0;
			this._startTime_ctx = 0;
			this._muted = false;
			this._volume = 1;
			this._rate = 1;
			this._endTimer = -1;

			this._buffer = null;
			this._audioEL = null;
		};
		_KSound.prototype = $extend(_KMedia.prototype, {
				getMuted : function(){return this._muted}
			, 	setMuted : function(muted){
					this._muted = muted;
					if(this._gain){
						this._gain.gain.value = this._muted?0:this._volume;
					}
					return this._muted;
				}
			,	getVolume : function(){return this._volume}
			,	setVolume : function(val){
					this._volume = val;
					if(this._gain){
						this._gain.gain.value = this._muted?0:this._volume;
					}
					return this._volume;
				}
			,	getRate : function(){return this._rate}
			,	setRate : function(val){
					this._rate = val;
					/*TO DO */
					return this._rate;
				}
			, 	currentTime_abs : function(){
					if(this._playState== _MPRState.PLAYING){
						if(this._audioEL) return Math.round(this._audioEL.currentTime * 1000)
						else return this._startTime_play + Math.round(_ctx.currentTime * 1000) -this._startTime_ctx;
					}else{
						return this._currentPos_abs;	
					}
				}
			,	init : function(url){
					if(this._loadState>=_INITED)
						return;
					
					this._url = url;
					this._currentPos_abs = 0;
					this._loop = 1;
					this._maxtime = 0;
					
					this._bGotoAndPlay = false;
					this._startTime_temp = -1;
					this._endTime_temp = -1;
					this._loop_temp = -1;
					this._loopCnt_temp = 0;
					this._loadState = _INITED;
				}
			,	handleEvent : function(event) {
					if(event.type=="canplaythrough"){
						if(!this._audioEL || this._loadState>_LOADING || isNaN(this._audioEL.duration) || this._audioEL.duration<=0) return;
						var maxtime = Math.round(this._audioEL.duration * 1000);
						_durationChanged(this, maxtime);
						_setPlayState(this, _MPRState.READY);
						if(this._bGotoAndPlay){
							this.gotoAndPlay(this._startTime_temp, this._endTime_temp, this._loop_temp);	
						}else if(this._bPlay){
							if(_isEnabled) this.seek(this._seekTime);
							else{
								this._bPlay = false;
								_setPlayState(this, _MPRState.PAUSED);
							}
						}			
					}else if(event.type=="error"){
						_setPlayState(this, _MPRState.LOAD_ERROR);
					}else if(event.type=="ended"){
						_onEnd(this);
					}
				}
			,	load : function(){
					var objK = this;
					if(objK._loadState>=_LOADING) return;
					var url = objK._url;
					_setPlayState(objK, _MPRState.LOADING);
	
					if(!_ctx || !window.useSoundApi){
						var audio = document.createElement("audio");
						objK._audioEL = audio;
						audio.controls = false;
						audio.autoplay = false;
						audio.preload = "auto";
						audio.src = url;
						audio.addEventListener ("canplaythrough", objK);
						audio.addEventListener ("error",objK);
					}else{
						var xhr = new XMLHttpRequest();
						xhr.open('GET', url, true);
						xhr.responseType = 'arraybuffer';
						xhr.onload = function() {
							if(objK._loadState!=_LOADING) return;
							
							var code = (xhr.status + '')[0];
							if (code !== '0' && code !== '2' && code !== '3') {
								  _setPlayState(objK, _MPRState.LOAD_ERROR);
								  return;
							}
							
							_ctx.decodeAudioData(xhr.response, function(buffer) {
								if(objK._loadState!=_LOADING){
									return;
								}
								if (buffer) {
									objK._buffer = buffer;
									var maxtime = Math.round(buffer.duration * 1000);
									_durationChanged(objK, maxtime);
									_setPlayState(objK, _MPRState.READY);
									if(objK._bGotoAndPlay){
										objK.gotoAndPlay(objK._startTime_temp, objK._endTime_temp, objK._loop_temp);	
									}else if(objK._bPlay){
										if(_isEnabled) objK.seek(objK._seekTime);
										else{
											objK._bPlay = false;
											_setPlayState(objK, _MPRState.PAUSED);
										}
									}
								}else{
									_setPlayState(objK, _MPRState.LOAD_ERROR);
								}
							}, function() {
								_setPlayState(objK, _MPRState.LOAD_ERROR);
							});
						};
						xhr.onerror = function() {
							_setPlayState(objK, _MPRState.LOAD_ERROR);
						};
						try{xhr.send();}catch(e){xhr.onerror();}
	
					}
				}
			,	destory : function(){
					_pauseMedia(this);
					if(this._audioEL){
						this._audioEL.removeEventListener ("canplaythrough", this);
						this._audioEL.removeEventListener ("error",this);
						this._audioEL.removeEventListener ("ended", this);
						this._audioEL = null;
					}
					
					this._buffer = null;
					_KMedia.prototype.destory.call(this);
				}
		});
		_kmedia.KSound = _KSound;
	})();
	/* Sound 시작 */
	
	/* Video 시작 */
	(function(){
		var _videoLoaded = function(objK) {
			if(objK._maxtime>0) return;
			var maxtime = Math.round(objK.video.duration * 1000);
			if(maxtime>0){
				_durationChanged(objK, maxtime);
				_setPlayState(objK, _MPRState.READY);
				if(objK.onLoad){
					objK.onLoad.call(null);
				}
				
				if(objK._bGotoAndPlay){
					objK.gotoAndPlay(objK._startTime_temp, objK._endTime_temp, objK._loop_temp);
				}else if(objK._bPlay){
					objK.seek(objK._seekTime);	
				}else{
					objK.seek(0);	
				}
			}else{
				_setPlayState(objK, _MPRState.LOAD_ERROR);
			}
		};

		function _onPause(objK){
			_setPlayState(objK, _MPRState.PAUSED);
		}
		function _onSeeking(objK){
			_setPlayState(objK, _MPRState.BUFFERING);
		}
		function _onSeeked(objK){
			if(objK.video.paused){
				_setPlayState(objK, _MPRState.PAUSED);
				
				if(objK._bPlay) objK.video.play();
			}else{
				_setPlayState(objK, _MPRState.PLAYING);
				if(!objK._bPlay) objK.video.pause();
			}
		}
		
		function _onPlaying(objK){
			_setPlayState(objK, _MPRState.PLAYING);
		}
	

		function _onCanPlayThrough(objK){
			_videoLoaded(objK);
		}
		var  _KVideo = function(width, height, MPRState){
			_MPRState = MPRState;
			_KMedia.call(this);
			
			this._playState = _MPRState.UNINITIALIZED;
			this.width = width;
			this.height = height;	
			var video = document.createElement ("video");
			video.controls = false;
			video.autoplay = false;
			video.preload = "none";
			
			video.addEventListener ("ended", this);
			video.addEventListener ("pause", this);
			video.addEventListener ("seeking", this);
			video.addEventListener ("seeked", this);
			video.addEventListener ("playing", this);
			video.addEventListener ("canplaythrough", this);
			
			video.width = width;
			video.height = height;
			this.video = video;
		};
		
		_KVideo.prototype = $extend(_KMedia.prototype, {
			setWidth : function(value){
				this.width = value;
				this.video.width = value;
				return this.width;
			}
		,	setHeight : function(value){
				this.height = value;
				this.video.height = value;
				return this.height;
			}
		,	getMuted : function(){return this.video.muted;}
		,	setMuted : function(muted){
				this.video.muted = muted;
				return muted;
			}
		,	getVolume : function(){return this.video.volume;}
		,	setVolume : function(val){
				this.video.volume = val;
				return val;
			}
		,	canSetVolume : function(){return !_isIOS;}
		,	getRate : function(){return this.vido.playbackRate;}
		,	setRate : function(val){
				this.vido.playbackRate = val;
				return val;
			}
		,	currentTime_abs : function(){
				if(this._playState== _MPRState.PLAYING){
					return Math.round(this.video.currentTime  * 1000);
				}else{
					return this._currentPos_abs;	
				}
			}
		,	mediaWidth : function(){
				return (this.video.videoWidth)?this.video.videoWidth:this.width;
			}
		,	mediaHeight : function(){
				return (this.video.videoHeight)?this.video.videoHeight:this.height;
			}
		,	bPlay : function(){return !this.video.paused;}
		,	init : function(url){
				if(this._loadState>=_LOADING) return;
				this._url = url;
				this._currentPos_abs = 0;
				this._loop = 1;
				this._maxtime = 0;
				
				this._bGotoAndPlay = false;
				this._startTime_temp = -1;
				this._endTime_temp = -1;
				this._loop_temp = -1;
				this._loopCnt_temp = 0;
				this.video.src = url;
				if(typeof(this.video.load)=="function") this.video.load();
				_setPlayState(this, _MPRState.LOADING);	
			}
		,	destory : function(){
				if(this.video){
					this.video.removeEventListener ("ended", this);
					this.video.removeEventListener ("pause", this);
					this.video.removeEventListener ("seeking", this);
					this.video.removeEventListener ("seeked", this);
					this.video.removeEventListener ("playing", this);
					this.video.removeEventListener ("canplaythrough", this);
					_pauseMedia(this);
					this.video = null;
					_KSound.prototype.destory.call(this);
				}
			}
		,	handleEvent : function(evt){
				if(evt.type=="ended") _onEnd(this);
				else if(evt.type=="pause") _onPause(this);
				else if(evt.type=="seeking") _onSeeking(this);
				else if(evt.type=="seeked") _onSeeked(this);
				else if(evt.type=="playing") _onPlaying(this);
				else if(evt.type=="canplaythrough") _onCanPlayThrough(this);
			}
		});	
		_kmedia.KVideo = _KVideo;
	})();
	window.kmedia = _kmedia;
}
})();