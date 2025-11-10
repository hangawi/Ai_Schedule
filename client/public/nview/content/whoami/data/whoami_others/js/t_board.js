var _obj = {};

var _index;

var _stored_list;
var _my_word_list;
var _my_list;

var phaseBuzzer = false;
var questionClicked = false;
var buzzerClicked = false;
var profileClicked = false;

var _direction_of_move;

var _current_mode = 1;

var _track_list = [];

var _word = 0;
var _is_paused = false;

var _from = location.href.split('?from=')[1];

if (__store.get('lesson_index') !== 'undefined') {
  _index = __store.get('lesson_index');

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

}

function handleBuzzerClicked() {
  // if (buzzerClicked) return false;
  if (window.parent._buzzered == true) return false;
  window.parent._buzzered = true;
  buzzerClicked = true;

  $('#userProfile').attr('disabled', true);

  $('#buzzerUser').css('opacity', 1);
  $('#buzzerClick').css('z-index', '-1');
  $('#buzzerClick').css('transition', 'none');
  $('#buzzerClick').find('img').attr('src', './assets/img/btn_buzzer_on.png');
  $('#buzzerClick').attr('disabled', true);

  _obj = window.parent._sharedObject;

  var _idx = window.parent._studentsList.map(function (e) { return e.id }).indexOf(_obj.buzzeredUser.id);

  var _buzzerUser = window.parent._studentsList[_idx];

  if (window.parent.buzzeredUser == null) window.parent.buzzeredUser = _buzzerUser;
  if (window.parent.firstBuzzerUser == false) {
    _obj.firstBuzzerUser = window.parent.buzzeredUser;
    window.parent.firstBuzzerUser = true;
  }

  var _displayMode = Number(_buzzerUser.displayMode);
  var _bImg, _bName;
  if (_displayMode == 1) {
    _bImg = _buzzerUser.thumb;
    _bName = _buzzerUser.name;
    if (_buzzerUser.name == '') _bName = _buzzerUser.nickname;
  } else {
    _bImg = _buzzerUser.avatar;
    _bName = _buzzerUser.nickname;
    if (_buzzerUser.nickname == '') _bName = _buzzerUser.name;
  }

  window.handleProtocol('setThreeminInfo', _obj);

  // _bImg = '';
  if (_bImg != '') {
    $('#buzzerUser').find('img').hide().attr('src', _bImg).show().addClass('animate__animated animate__fadeInUp');
    $('#bImg').css('opacity', 1);
  } else {
    var iName = _bName.substr(0, 2).toUpperCase();
    var iGender = _buzzerUser.gender;
    if (_buzzerUser.gender == undefined || _buzzerUser.gender == '' || _buzzerUser.gender.toUpperCase() == 'M') {
      iGender = 'male';
    } else if (_buzzerUser.gender.toUpperCase() == 'F') {
      iGender = 'female';
    }
    $('#bImg').remove();
    $('#buzzerUser').addClass('changedImg');
    $('#buzzerUser .iName').remove();
    $('#buzzerUser .imgArea').addClass('animate__animated animate__fadeInUp').append('<div class="iName ' + iGender + '">' + iName + '</div>');
  }
  $('#bName').text(_bName);
  $('#buzzerUser p').fadeIn();

  setTimeout(function () {
    window.handleProtocol('callThreeminInfo', 'fnToAttention');
  }, 100);
}

var count = 0;

function handleBuzzeredUserSync() {
  _obj = window.parent._sharedObject;
  if (window.parent.firstBuzzerUser == true) _obj.firstBuzzerUser = window.parent.firstBuzzerUser;
  if (window.parent.buzzeredUser != null) _obj.buzzeredUser = window.parent.buzzeredUser;
  count++;

  window.handleProtocol('setThreeminInfo', _obj);

  setTimeout(function () { window.handleProtocol('setThreeminInfo', _obj); }, 1000);
}

function handleAnswerCorrect() {
  document.location.href = 't_final.html';
}

function handleAnswerWrong() {
  count = 0;
  window.parent._buzzered = false;
  window.parent.firstBuzzerUser = false;
  window.parent.buzzeredUser = null;
  phaseBuzzer = true;
  questionClicked = true;
  buzzerClicked = false;

  _obj = window.parent._sharedObject;
  _obj.firstBuzzerUser = null;
  _obj.buzzeredUser = null;
  window.handleProtocol('setThreeminInfo', _obj);

  $('#buzzerClick, #profileClick').removeClass('animate__pulse');
  $('#userProfile img').fadeOut();
  $('#userProfile .iName').fadeOut();
  $('#buzzerUser').css('opacity', 0);
  $('#buzzerClick').attr('disabled', false);
  $('#buzzerClick').css('z-index', '99');
  $('#buzzerClick img').attr('src', './assets/img/btn_buzzer_off.png');
  $('#buzzerUser').removeClass('changedImg');
  $('#buzzerUser .imgArea').removeClass('animate__animated animate__fadeInUp')
  $('#buzzerUser img').removeClass('animate__animated animate__fadeInUp')
  setTimeout(function () {
    $('#buzzerClick, #profileClick').addClass('animate__pulse');
    window.handleProtocol('callThreeminInfo', 'fnForceToAttention');
  }, 500);
}

$(document).ready(function () {
  window.parent._buzzered = false;
  window.parent.firstBuzzerUser = false;
  window.parent.buzzeredUser = null;

  window.globalHandleNotifyCurrentPage(1);
  window.handleProtocol('totalpage', 1);

  setTimeout(function () {
    $(".vs-position-change .md-switch-label").after($(".vs-position-change .md-switch-container"));
    $(".vs-position-change").show();
  }, 100);


  var $main = new Vue({
    el: '#main',

    created: function () {
      $$main = this;
    },

    mounted: function () {
      this.$nextTick(function () {
        this.bgm = window.parent._bgm;

        $('#buzzerClick, #profileClick').addClass(' animate__pulse animate__repeat-2');
        window.handleProtocol('getThreeminInfo');
        setTimeout(function () {
          _obj = window.parent._sharedObject;
        }, 200);
      });
    },

    computed: {

    },

    data: {
      bgm: true,
    },

    methods: {
      moduleClick: function (e) {
        $('.vs-white-button').removeClass('selected');
        // console.log($(e.target).attr('module'))
        $(e.currentTarget).addClass('selected');
      },
      noteClick: function (e) {
        location.href = 'got_note.html';
      },
      profileClick: function (e) {
        if (buzzerClicked) return false;
        if (profileClicked) return false;
        questionClicked = true;
        profileClicked = true;
        setTimeout(function () { profileClicked = false; }, 1000);

        if ($('#userProfile').find('img').attr('src') != '') {
          $('#qImg').css('opacity', 0);
          $('#userProfile').find('img').attr('src', '');
          $('#userProfile').find('img').removeClass('animate__animated animate__fadeInUp');
          $('#userProfile').find('.imgArea').removeClass('animate__animated animate__fadeInUp');
          $('#userProfile p').hide();
        }
        play($('#vs-effect')[0], './mp3/box.mp3');

        setTimeout(function () {
          var arrUser = JSON.parse(JSON.stringify(window.parent._studentsList));
          var opened = window.parent._user_opened;
          var arrTmp = arrUser.map(function (e) { return e.id }).indexOf(opened.id); //arrUser.indexOf(opened);
          arrUser.splice(arrTmp, 1);
          var user_questioner = getRandom(arrUser, 1)[0];
          if (arrUser.length > 1 && _obj.user_questioner != undefined) {
            while (user_questioner.id == _obj.user_questioner.id) {
              user_questioner = getRandom(arrUser, 1)[0];
            }
          }
          _obj.user_questioner = user_questioner;

          var _displayMode = Number(user_questioner.displayMode);
          var _qImg, _qName;
          if (_displayMode == 1) {
            _qImg = user_questioner.thumb;
            _qName = user_questioner.name;
            if (user_questioner.name == '') _qName = user_questioner.nickname;
          } else {
            _qImg = user_questioner.avatar;
            _qName = user_questioner.nickname;
            if (user_questioner.nickname == '') _qName = user_questioner.name;
          }

          setTimeout(function () {
            // _qImg = '';
            if (_qImg != '') {
              $('#userProfile').find('img').hide().attr('src', _qImg).show().addClass('animate__animated animate__fadeInUp');
              $('#qImg').css('opacity', 1);
            } else {
              var iName = _qName.substr(0, 2).toUpperCase();
              var iGender = user_questioner.gender;
              if (user_questioner.gender == undefined || user_questioner.gender == '' || user_questioner.gender.toUpperCase() == 'M') {
                iGender = 'male';
              } else if (user_questioner.gender.toUpperCase() == 'F') {
                iGender = 'female';
              }
              $('#qImg').remove();
              $('#userProfile .iName').remove();
              $('#userProfile .imgArea').addClass('animate__animated animate__fadeInUp').append('<div class="iName ' + iGender + '">' + iName + '</div>');
            }

            $('#qName').text(_qName);
            $('#userProfile p').fadeIn();
          }, 100)

          window.handleProtocol('setThreeminInfo', _obj);
          setTimeout(function () {
            window.handleProtocol('callThreeminInfo', 'fnToQuestion');
          }, 100);
        }, 100)

        setTimeout(function () {
          $('#effect_ani').fadeIn();
          $('#effect_ani').attr('src', './assets/img/aniQInfo.gif?' + Math.random(10));
        }, 400);
      },
      buzzerClick: function (e) {
        if (!questionClicked) return false;
        buzzerClicked = true;
        if ($(e.currentTarget).find('img').attr('src') == './assets/img/btn_buzzer_on.png') {
          return false;
        } else {
          phaseBuzzer = true;
          play($('#vs-effect')[0], './mp3/buzzer.mp3');
          // $('#buzzerUser').css('opacity', '1');
          $(e.currentTarget).parent().removeClass('mt-m-200')
          $(e.currentTarget).removeClass('mt-m-200').addClass('mt-m-200');
          $(e.currentTarget).css('transition', 'none');
          $(e.currentTarget).find('img').attr('src', './assets/img/btn_buzzer_on.png');
          $(e.currentTarget).attr('disabled', true);

          $('#userProfile').find('img').attr('src', '');
          $('#userProfile').find('img').css('opacity', 0);
          $('#userProfile').find('img').removeClass('animate__animated animate__fadeInUp');
          $('#userProfile').find('.imgArea').removeClass('animate__animated animate__fadeInUp');
          $('#userProfile').find('.imgArea .iName').remove();
          $('#userProfile p').hide();

          setTimeout(function () {
            window.handleProtocol('callThreeminInfo', 'fnToBuzzer');
            // buzzerClicked = false;
          }, 300);
        }
      },
      toHome: function (e) {
        window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
        window.handleProtocol('callRetry');
        window.parent._sharedObject = null;
        window.parent._bgm = false;
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
  });

  $('.md-tabs-navigation-scroll-container').prepend("<span class='list-title'>TEST Mode</span>");

  $('.md-theme-default.md-tabs > .md-tabs-navigation .md-tab-indicator').prepend('<i aria-hidden="true" class="md-icon md-size-3x md-theme-default material-icons arrow_up_indicator">arrow_drop_up</i>');
  $('.md-theme-default.md-tabs > .md-tabs-navigation .md-tab-indicator').css('left', '180px');

  $(parent.document).find('body').find('.btn_ok').click(function () {
    window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
    questionClicked = false;
    buzzerClicked = true;
    if ($(parent.document).find('body').find('.pop_box .text').text() == 'Retry?') {
      window.parent._sharedObject = null;
      setTimeout(function () {
        // document.location.reload();
        window.loadPage('t_note.html');
      }, 300);
    }
  });
});
