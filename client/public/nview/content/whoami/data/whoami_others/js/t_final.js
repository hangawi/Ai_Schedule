var _index;

var _stored_list;
var _my_word_list;
var _my_list;

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

function _init_content() {

}

$(document).ready(function () {
  // $('.md-tabs-content').remove();

  // var $loader = new Vue({
  //   el: '#loader',
  // });
  $('#rImg').css('opacity', 0);
  $('#rName').text('');
  setTimeout(function () {
    $(".vs-position-change .md-switch-label").after($(".vs-position-change .md-switch-container"));
    $(".vs-position-change").show();
  }, 100);


  var $main = new Vue({
    el: '#main',

    created: function () {

      $$main = this;

      this.resultData = window.parent._sharedObject.activityData[window.parent._sharedObject.correct];

    },

    mounted: function () {

      this.$nextTick(function () {
        this.bgm = window.parent._bgm;
        play($('#vs-effect')[0], './mp3/answerer.mp3');
        // if (this.bgm) {
        //   play($(window.parent.document).find('#vs-bgm')[0], './mp3/whoami_bgm.mp3');
        // }
      });
    },

    computed: {

    },

    data: {
      bgm: true,
      resultData: null,
    },

    methods: {
      toHome: function (e) {
        play($('#vs-effect')[0], './mp3/click.mp3');
        window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
        setTimeout(function (e) {
          window.handleProtocol('callRetry');
          window.parent._sharedObject = null;
          location.href = 'start.html';
        }, 500);
      },
      moduleClick: function (e) {
        $('.vs-white-button').removeClass('selected');
        // console.log($(e.target).attr('module'))
        $(e.currentTarget).addClass('selected');
      }
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

  // $('#main').hide();
  // $('#loader').remove();
  // $('#main').show();
  setTimeout(function () {
    _obj = window.parent._sharedObject;

    var _idx = window.parent._studentsList.map(function (e) { return e.id }).indexOf(_obj.correctUser.id);

    var _buzzerUser = window.parent._studentsList[_idx];

    var _displayMode = Number(_buzzerUser.displayMode);
    var _rImg, _rName;
    if (_displayMode == 1) {
      _rImg = _buzzerUser.thumb;
      _rName = _buzzerUser.name;
      if (_buzzerUser.name == '') _rName = _buzzerUser.nickname;
    } else {
      _rImg = _buzzerUser.avatar;
      _rName = _buzzerUser.nickname;
      if (_buzzerUser.nickname == '') _rName = _buzzerUser.name;
    }
    // if (_rImg == '') _rImg = './assets/img/questioner_medal_image.png';
    // _rImg = '';
    if (_rImg != '') {
      $('#rImg').find('img').hide().attr('src', _rImg).show().addClass('animate__animated animate__fadeInUp');
      $('#rImg').css('opacity', 1);
      $('#rName').text(_rName);
      $('#rName').fadeIn();
    } else {
      var iName = _rName.substr(0, 2).toUpperCase();
      var iGender = _buzzerUser.gender;
      if (_buzzerUser.gender == undefined || _buzzerUser.gender == '' || _buzzerUser.gender.toUpperCase() == 'M') {
        iGender = 'male';
      } else if (_buzzerUser.gender.toUpperCase() == 'F') {
        iGender = 'female';
      }
      $('#rImg img').remove();
      $('#rImg .iName').remove();
      $('#rImg').append('<div class="iName ' + iGender + '">' + iName + '</div>');
    }
    $('#rImg').css('opacity', 1);
    setTimeout(function () {
      $('#rImg').find('img').hide().attr('src', _rImg).show().addClass('animate__animated animate__fadeInUp');
      $('#rName').text(_rName);
      $('#rName').fadeIn();
    }, 300);
  }, 1000);

  $(parent.document).find('body').find('.btn_progress').click(function () {
    window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
  });

  $(parent.document).find('body').find('.btn_ok').click(function () {
    if ($(parent.document).find('body').find('.pop_box .text').text() == 'Retry?') {
      window.parent._bgm = false;
      window.parent._sharedObject = null;
      window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
      setTimeout(function () {
        // document.location.reload();
        window.loadPage('t_note.html');
      }, 300);
    }
  });
});
