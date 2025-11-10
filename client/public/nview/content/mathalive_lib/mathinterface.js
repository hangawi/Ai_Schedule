var domtoimage_o = {
  isTeacher: false,
  capture: function () {
    const element = document.getElementById('viewer');
    // console.log("element", element)
    domtoimage.toPng(element, {
        bgcolor: '#ffffff'
      })
      .then(function (dataUrl) {
        msg = {};
        msg.base64Img = dataUrl;
        // console.log("dataurl", dataUrl);
        this.sendPostMessage('domtoimage', msg);
      });
  }
};

var current_o = {
  idx: -1,
  quizmode: '',
  content: null,
  isTeacher: false,
  completed: false,
  init: function (idx) {
    current_o.idx = idx;
  }
};

let totalpage = 0;
// if(parent._data.quizs && parent._data.quizs.length > 1){
const sAct = window.parent.document.querySelector('.s_activity');
if(sAct){
  parent._data.quizs[1].activepage.map((p, idx) => {
    totalpage += p;
  })
}

var _viewer, _pagination, _page_btn, _total_pages, _init, _show, _moveInt, _3minInt;
var _nextPlay = false;
window.addEventListener('message', handlePostMessage, false);

function handlePostMessage(evt) {
  // console.log('content handlePostMessage', evt.data);
  clearInterval(_moveInt);
  const data = evt.data;
  if(data.from != 'matemplate' || data.type != 'setThreeminState') {
    clearInterval(_3minInt);
  }
  if (data.from == 'matemplate') {
    if (data.type == 'init') {
      // console.log('content init', data.msg);
      if (data.msg.idx) current_o.idx = data.msg.idx;
      if (data.msg.quizmode) current_o.quizmode = data.msg.quizmode;
      if (data.msg.content) current_o.content = data.msg.content;
      if (data.msg.isTeacher) current_o.isTeacher = data.msg.isTeacher;
    } else if (data.type == 'completed') {
      // console.log('content completed', data.msg);
    } else if (data.type == 'domtoimage') {
      domtoimage_o.capture();
    } else if (data.type == 'movepage') {
      console.log('무브페이지', data.msg.page);
      handleProtocol('changepage', data.msg.page)
      var tryMoveCount = 0;

      clearInterval(_moveInt);
      _moveInt = setInterval(function () {
        _viewer = document.querySelector('#viewer');
        tryMoveCount++;
        if (tryMoveCount > 20) clearInterval(_moveInt);
        if(_viewer != null) {
          _pagination = document.querySelector('.pagination');
          clearInterval(_moveInt);
          data.msg.retry ? movepage(data.msg.page, data.msg.retry) : movepage(data.msg.page);
          if (_pagination != null) {
            _page_btn = _pagination.getElementsByClassName('page-btn');
            clearInterval(_moveInt);
            data.msg.retry ? movepage(data.msg.page, data.msg.retry) : movepage(data.msg.page);
            if (_page_btn != null) {
              clearInterval(_moveInt);
              data.msg.retry ? movepage(data.msg.page, data.msg.retry) : movepage(data.msg.page);
              handleProtocol('changepageend', null)
            }
          }
        }
      }, 100);
      var try3minCount = 0;
      clearInterval(_3minInt);
      _3minInt = setInterval(function() {
        try3minCount++;
        // console.log('++' + try3minCount);
        if (try3minCount >= 20) {
          clearInterval(_3minInt);
        }
        if (window.parent._sharedObject != undefined) {
          if (window.parent._sharedObject.s_target != undefined) {
            clearInterval(_3minInt);
            if (window.parent._sharedObject.init == true) return;
            handleAttention(true);
            loadPage(window.parent._sharedObject.s_target);
            setTimeout(function () { handleAttention(true); }, 300);
          }
        }
      }, 100);
    } else if (data.type == 'nextplay') {
      // 활동이 2개이상인 경우 (ex: C6)
      // console.log('다음 활동', data.msg.page);
      _nextPlay = true;
      handleAttention(false);
      setTimeout(function() {
        handleAttention(true);
        _nextPlay = false;
      }, 1000);
      movepage(data.msg.page);
    } else if (data.type == 'notifyStudents') {
      // console.log('notifyStudents', data.msg);
      sendPostMessage('notifyStudents', data.msg)
    } else if (data.type == 'notifyStudent') {
      // console.log('notifyStudent', data.msg);
      sendPostMessage('notifyStudent', data.msg)
    } else if (data.type == 'setThreeminState') {
      // console.log('mathinter setThreeminState', data);

      if(data.msg.data.id) {
        if(data.msg.data.state === '') {
          // console.log('학생 ID 없음',);
        } else {
          window.parent._studentId = data.msg.data.state;
        }
        return;
      }

      window.parent._sharedObject = data.msg.data.state;
      // console.log('window.parent._sharedObject', window.parent._sharedObject);
    } else if (data.type == 'getThreeminState') {
      // console.log('mathinter getThreeminState', data);
    } else if (data.type == 'callThreeminState') {
      // console.log('callThreeminState', data.msg.data.state);
      eval(data.msg.data.state)();
    } else if (data.type == 'initThreeminState') {
      // console.log('initThreeminState', data.msg.data.state);
      window.parent._studentsList = data.msg.data.state;
    }
  }
}

function sendPostMessage(type, msg) {
  // console.log('content sendPostMessage', type, msg);
  var postMsgData = {
    from: 'macontent',
    to: "matemplate",
    type: type,
    msg: msg
  };
  window.parent.postMessage(postMsgData, '*');
}

// heyhey
var _currentPage;
document.addEventListener("DOMContentLoaded", function (event) {
  // console.log('DOMContentLoaded')
  _init = setInterval(function () {
    _viewer = document.querySelector('#viewer');
    if(_viewer != null) {
      _pagination = document.querySelector('.pagination');
      if (_pagination != null) {
        _page_btn = _pagination.getElementsByClassName('page-btn');
        if (_page_btn != null) {
          if (_page_btn.length > 0) {
            handleProtocol('totalpage', _page_btn.length);
            clearInterval(_init);
          }
        }
      }
    }
  }, 100);
});

// function isCompleted() {
//   window.parent.document.querySelector('.s_activity').style.display = 'block';
//   window.parent.document.querySelector('.s_activity').style.opacity = 1;
//   // document.location.reload();
//   setTimeout(function () {
//     window.parent.document.querySelector('.s_activity').style.display = 'none';
//     window.parent.document.querySelector('.s_activity').style.opacity = 1;
//   }, 1000);
// }

var _isStudent = window.parent.document.location.href.indexOf('/student/') > 0;

function fadeIn(el, time) {
  el.style.opacity = 0;

  var last = +new Date();
  var tick = function () {
    el.style.opacity = +el.style.opacity + (new Date() - last) / time;
    last = +new Date();

    if (+el.style.opacity < 1) {
      (window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16);
    }
  };
  tick();
}

window._isInit = false;

function movepage(idx, retry) {
  var _target = Number(idx) - 1;
  if (_isStudent) {
    window._isInit = true;
  
    if(_isStudent && retry) {
      window.__vue__.volume = 0;
    }else{
      window.__vue__.volume = 1;
    }

    if(_currentPage == idx) {
      window.__vue__.$store.commit("viewer/document/GO_TO_PAGE", document.querySelector('.page-transition-cover').attributes['data-page-id'].value);
    }

    if (_currentPage == 1 || totalpage == 1) {
      setTimeout(function () {
        if(!_nextPlay) fadeIn(document.querySelector('body'), 300);
      }, 100);
    }
    
    if (totalpage > 1) {
      setTimeout(function() {
        handleAttention(false);
      }, 1000);
    }
  }

  // console.log('페이지 이동 버튼 클릭', _page_btn, _target);
  _page_btn[_target].click();
}

function sIndexTo3Min() {
  handleAttention(true);
  loadPage('s_index.html');
  window.parent._sharedObject = null;
  setTimeout(function () { handleAttention(true); }, 300);
}

function loadPage(arg) {
  document.location.href = arg;
}
// 컨텐츠에서 메세지 전달
function handleProtocol(_type, _msg) {
  // console.log('핸들프로토콜', );
  var type;
  var message = {};
  switch (_type) {
    case 'completed':
      type = 'completed';
      message = null;
      break;

    case 'totalpage':
      type = 'totalpage';
      message.page = _msg;
      break;

    case 'movepage':
      type = 'movepage';
      message.page = _msg;
      break;

    case 'changepage':
      type = 'changepage';
      message.page = _msg;
      break;

    case 'concepttool':
      type = 'concepttool';
      message = null;
      break;

    case 'showpentool':
      type = 'showpentool';
      message = null;
      break;
      
    case 'changepageend':
      type = 'changepageend';
      message = null;
      break;

    // 선생님에 요청
    case 'getStudents':
      type = 'getStudents';
      message = null;
      break;
      
    // 학생에 요청
    case 'getStudent':
      type = 'getStudent';
      message = null;
      break;

    case 'setThreeminInfo':
      type = 'setThreeminState';
      message = _msg;
      _sharedObject = _msg;
      // console.log('@@ ' + _sharedObject);
      break;

    case 'getThreeminInfo':
      type = 'getThreeminState';
      message = null;
      break;
    
    case 'callThreeminInfo':
      type = 'callThreeminState';
      message = _msg;
      break;
      
    case 'callRetry':
      type = 'callRetry';
      message = _msg;
      break;
  }
  sendPostMessage(type, message);
}

function handleAttention(flag) {
  if(flag) {
    parent.document.querySelector('.actPage').classList.add('bg_attention');
    document.querySelector('body').style.opacity = 0;
  } else {
    parent.document.querySelector('.actPage').classList.remove('bg_attention');
    document.querySelector('body').style.opacity = 1;
  }
}

window.globalHandleNotifyCurrentPage = function (arg) {
  _currentPage = arg;
  if (_isStudent) {
    if (_currentPage == 1) {
      setTimeout(function () {
        if (document.querySelector('.page-transition-cover') != null) {
          setTimeout(function () {
            if (document.querySelector('.page-transition-cover').innerHTML.length > 0) {
              if (window._isInit == false) {
                window.__vue__.volume = 0;
              }
            }
          }, 1);
        }
      }, 1);
    }

    if(_nextPlay) {
      handleAttention(false);
      return false;
    }
    if (totalpage == 1 || totalpage == 0 || _currentPage == totalpage) {
      handleAttention(true);
      return false;
    }

    if (_currentPage >= 1 && totalpage > 1) {
      if (_currentPage == 1) {
        handleAttention(true);
      } else {
        setTimeout(function() {
          handleAttention(false);
        }, 1000);
      }
    } else {
      if (totalpage == 1 || _currentPage == 1) {
        handleAttention(true);
      } else {
        handleAttention(false);
      }
    }
  }
  /*handleProtocol('changepage', arg);*/
}