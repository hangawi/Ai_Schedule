var _obj = {};
var _correct = null;

var _index;

var _stored_list;
var _my_word_list;
var _my_list;

var clickable = false;

var _direction_of_move;

var _current_mode = 1;

var _track_list = [];

var _word = 0;
var _is_paused = false;

var _from = location.href.split('?from=')[1];

if (__store.get('lesson_index') !== 'undefined') {
  _index = __store.get('lesson_index');
  // console.log('index = ' + _index)
  if (__store.get(_index + '_test_list') !== undefined && __store.get(_index + '_test_list') !== null) {
    _stored_list = __store.get(_index + '_test_list');
    _my_list = __store.get(_index + '_my_word_book');
  } else {
    _stored_list = __store.get(_index + '_my_word_book');
    _my_list = _stored_list;
  }

  if (__store.get(_index + '_my_word_book') !== undefined && __store.get(_index + '_my_word_book').length > 0) {
    _my_word_list = __store.get(_index + '_my_word_book');
  } else {
    _my_word_list = [];
  }
} else {
  // console.log('err')
}

var bgm = $(window.parent.document).find('#vs-bgm')[0];

function play(audio, url) {
  return new Promise(function (resolve, reject) { // return a promise
    // var audio = new Audio();                     // create audio wo/ src
    // var audio = $('#audio')[0];                     // create audio wo/ src
    audio.preload = "auto";                      // intend to play through
    audio.autoplay = true;                       // autoplay when loaded
    audio.onerror = reject;                      // on error, reject
    audio.onended = resolve;                     // when done, resolve
    audio.src = url
    if (url.indexOf('bgm') > 0) bgm = audio;
    audio.play();
  });
}

function swipeTarget(arg) {
  // console.log('TEST = ' + arg);
  $$main.currentWord = arg;
}

function getTarget() {
  return $$main.currentWord;
}

function numToNDigitStr(num, n) {
  if (num >= Math.pow(10, n - 1)) { return num; }
  return '0' + numToNDigitStr(num, n - 1);
}

function getRandom(arr, n) {
  var result = new Array(n),
    len = arr.length,
    taken = new Array(len);
  if (n > len)
    throw new RangeError("getRandom: more elements taken than available");
  while (n--) {
    var x = Math.floor(Math.random() * len);
    result[n] = arr[x in taken ? taken[x] : x];
    taken[x] = --len in taken ? taken[len] : len;
  }
  return result;
}

function _init_content() {
  window.handleProtocol('callThreeminInfo', 'fnToAttention');
  
  xmlData = $(x2js.json2xml(value)).find('lesson');

  wordsData = $($(xmlData)[Number(window.parent._checked) - 1]).find('item');

  // wordsData = getRandom(wordsData, 1);
  wordsData = getRandom(wordsData, 4);

  $$main.wordsData = wordsData;

  var listLength = wordsData.length;

  if (listLength > 0) {
    arrWords = [];
    wordData = [];

    var _id = 0;
    var __id = 0;

    _correct = getRandom([0, 1, 2, 3], 1);

    $(wordsData).each(function () {
      var _name = $(this).attr('eng');
      var _img = './assets/images/' + $$subject + '/' + $(this).attr('module') + '/' + $(this).attr('no') + '.png';
      arrWords.push({
        name: _name,
        img: _img,
        index: __id,
      });
      __id++;
    });
    _id++;
  }
  // console.log(arrWords)
  $$main.wordData = arrWords;

  setTimeout(function () {
    _obj.s_target = 'attention.html';
    _obj.activityData = arrWords;
    _obj.correct = _correct[0];
    _obj._index = _index;
    _obj._study_list = _my_list;

    setTimeout(function () {
      window.handleProtocol('setThreeminInfo', _obj);
    }, 200);
  }, 300);
}

$(document).ready(function () {
  // $('.md-tabs-content').remove();

  // var $loader = new Vue({
  //   el: '#loader',
  // });

  window.globalHandleNotifyCurrentPage(1);
  window.handleProtocol('totalpage', 1);

  parent.document.querySelector('#wrap .t_activity .fel_topad').style.display = 'block';
  
  setTimeout(function () {
    $(".vs-position-change .md-switch-label").after($(".vs-position-change .md-switch-container"));
    $(".vs-position-change").show();
  }, 100);


  var $main = new Vue({
    el: '#main',

    created: function () {
      $$main = this;

      _init_content();
    },

    mounted: function () {
      this.$nextTick(function () {
        this.bgm = window.parent._bgm;
        if (this.bgm) {
          var _path = document.location.pathname.split('t_note.html')[0];
          play($(window.parent.document).find('#vs-bgm')[0], _path + '/mp3/whoami_bgm.mp3');
        }
      });
    },

    computed: {

    },

    data: {
      bgm: true,
    },

    methods: {
      moduleClick: function (e) {
        play($('#vs-effect')[0], './mp3/click.mp3');
        $('.vs-white-button').removeClass('selected');
        // // console.log($(e.target).attr('module'));
        $(e.currentTarget).addClass('selected');
      },
      noteClick: function (e) {
        if(clickable) {
          play($('#vs-effect')[0], './mp3/note_send.mp3');
          var _current = $(e.currentTarget).attr('note');
          $('.vs-white-button').each(function (target) {
            // $(this).animte({ opacity: 0 }, 1000);
            if ($(this).attr('note') == _current) {
              $(this).removeClass('note_' + _current);
              var _class = 'rotate300';
              if (target > 2) {
                _class = 'rotate600'
              }
              $(this).addClass(_class)
              $(this).delay(500).animate({ opacity: 0, }, 500);
            } else {
              $(this).delay(200).animate({ opacity: 0, }, 500);
            }
          });

          setTimeout(function (e) {
            if (window.parent._studentsList.length >= 0) {
              var userId = getRandom(window.parent._studentsList, 1);

              var arrUser = JSON.parse(JSON.stringify(window.parent._studentsList));
              var opened = window.parent._user_opened;
              if (opened != undefined) {
                var arrTmp = arrUser.map(function (e) { return e.id }).indexOf(opened.id);
                arrUser.splice(arrTmp, 1);
                var user_temp = getRandom(arrUser, 1)[0];

                if(user_temp.id != opened.id) {
                  user_id = user_temp;
                } else {
                  if (arrUser.length > 1) {
                    while (user_temp.id == opened.id) {
                      user_temp = getRandom(arrUser, 1)[0];
                      userId = user_temp;
                    }
                  }
                }
              }
              
              _obj.user_opened = userId[0];
              window.parent._user_opened = userId[0];
              window.handleProtocol('setThreeminInfo', _obj);
              setTimeout(function () {
                window.handleProtocol('callThreeminInfo', 'fnToNote');
                setTimeout(function () {
                  location.href = 't_note_open.html';
                }, 1000);
              }, 500);
            }
          }, 1300);
        }
      },
      toHome: function(e) {
        window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
        window.handleProtocol('callRetry');
        window.parent._sharedObject = null;
        location.href = 'start.html';
      },
    },

    watch: {
      bgm: function (arg) {
        play($('#vs-effect')[0], './mp3/click.mp3');
        if (!arg) {
          bgm.pause();
          window.parent._bgm = false;
        } else {
          bgm.play();
          window.parent._bgm = true;
        }
      },
    }
  });;

  $('.md-tabs-navigation-scroll-container').prepend("<span class='list-title'>TEST Mode</span>");

  $('.md-theme-default.md-tabs > .md-tabs-navigation .md-tab-indicator').prepend('<i aria-hidden="true" class="md-icon md-size-3x md-theme-default material-icons arrow_up_indicator">arrow_drop_up</i>');
  $('.md-theme-default.md-tabs > .md-tabs-navigation .md-tab-indicator').css('left', '180px');

  // $('#main').hide();
  // $('#loader').remove();
  // $('#main').show();

  var list_target;
  if (window.parent._checked == '1') list_target = 'animal';
  if (window.parent._checked == '2') list_target = 'place';
  if (window.parent._checked == '3') list_target = 'things';

  $(parent.document).find('body').find('.fel_topad').bind('touchstart click', function () {
    setTimeout(function () {
      if (window.parent._userList == undefined) window.parent._userList = window.parent._studentsList;
      clickable = true;
      _obj.init = true;
      _obj.list_target = list_target;
    }, 200);
    setTimeout(function () {
      _obj.s_length = window.parent._studentsList.length;
      window.handleProtocol('setThreeminInfo', _obj);
      getRandom($('button.vs-white-button'), 1)[0].click();
    }, 300);
  });

  $(parent.document).find('body').find('.btn_ok').click(function () {
    window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
    if ($(parent.document).find('body').find('.pop_box .text').text() == 'Retry?') {
      window.parent._sharedObject = null;
      setTimeout(function () {
        document.location.reload();
        // window.loadPage('t_note.html');
      }, 300);
    }
  });
});
