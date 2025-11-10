var _index;

var _stored_list;
var _my_word_list;
var _my_list;

var _direction_of_move;

var _current_mode = 1;

var _track_list = [];

var _word = 0;
var _is_paused = false;

var _playing = false;

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
  $$main.currentWord = arg;
}

function getTarget() {
  return $$main.currentWord;
}

function _init_content() {

}

var _timeouts = [];
var _x = [40, 120, 200, 270, 110, 190, 260, 30,];
var _y = [250, 290, 260, 210, 200, 170, 120, 160,];

var _origin = $($('.md-layout-item #user')[0]).clone();
$($('.md-layout-item #user')[0]).hide();

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

function handleProgress() {
  setTimeout(function () {
    play($('#vs-effect')[0], './mp3/effect/bingo_finish.mp3');

    window.parent._sharedObject._bingoUser.forEach(function (user) {
      if (user.isBingo == true) {
        window.parent._bingoUser.forEach(function (pUser) {
          if (pUser.id == user.id) {
            console.log('## ' + pUser.id + ' ' + user.id)
            pUser.isBingo = true;
          }
        });
      }
    });

    var tempArr = window.parent._bingoUser;
    window.parent._bingoUser = tempArr.filter((v, i, a) => a.findIndex(t => (t.id == v.id && t.id == v.id)) == i);

    var _bingoUser = window.parent._bingoUser;
    var _completedUser = [];
    var bImg;
    var bName;

    _bingoUser.forEach(function (user) {
      if (user.isBingo) {
        _completedUser.push(user)
      }
    });

    var _length = _completedUser.length;

    $('.md-layout-item #user').remove();

    for (var i = 0; i < _length; i++) {
      $(_origin[0]).clone().appendTo($('.md-layout-item')).hide();
    }
    _completedUser.forEach(function (bUser, idx) {
      if (bUser.isBingo) {
        if (bUser.displayMode == '1') {
          bImg = bUser.thumb;
          bName = bUser.name;
          if (bName == '') bName = bUser.nickname;
        } else {
          bImg = bUser.avatar;
          bName = bUser.nickname;
          if (bName == '') bName = bUser.name;
        }
        if (bImg != '') {
          $($($('.md-layout-item #user')[idx]).find('img')[0]).attr('src', bImg);
        } else {
          // $($($('.md-layout-item #user')[idx]).find('img')[0]).attr('src', './assets/img/avatar_01.png');
          var iName = bName.substr(0, 2).toUpperCase();
          var iGender = bUser.gender;
          if (bUser.gender == undefined || bUser.gender == '' || bUser.gender.toUpperCase() == 'M') {
            iGender = 'male';
          } else if (bUser.gender.toUpperCase() == 'F') {
            iGender = 'female';
          }
          $($($('.md-layout-item #user')[idx]).find('img')[0]).remove();
          $($($('.md-layout-item #user')[idx]).find('.iName')).remove();
          $($($('.md-layout-item #user')[idx]).find('#imgArea')).append('<div class="iName ' + iGender + '">' + iName + '</div>');
        }
        $($($('.md-layout-item #user')[idx]).find('p')[0]).text(bName);
      }
    });

    $('.md-layout-item #user').fadeIn();

    $('.md-layout-item #user p').css({ 'line-height': '1em' });

    if (_length > 4) {
      $('.md-layout-item #user #imgArea').css({ 'width': '128px', 'height': '128px', 'font-size': '70px' });
      $('.md-layout-item #user p').css({ 'width': '128px', 'font-size': '30px' });
    }

    if (_length > 14) {
      $('.md-layout-item #user #imgArea').css({ 'width': '96px', 'height': '96px', 'font-size': '40px' });
      $('.md-layout-item #user p').css({ 'width': '96px', 'font-size': '24px' });
    }
  }, 500);
}

$(document).ready(function () {
  setTimeout(function () {
    $(".vs-position-change .md-switch-label").after($(".vs-position-change .md-switch-container"));
    $(".vs-position-change").show();
  }, 100);

  var $main = new Vue({
    el: '#main',

    created: function () {
      $$main = this;

      this.$nextTick(function () {

      });
    },

    mounted: function () {
      this.$nextTick(function () {
        if (document.location.hash) {
          var hash = document.location.hash.split('_');

          var level = hash[0].split('#')[1];
          var grid = hash[1];
          var row = hash[2];

          this.level = level;
          this.grid = grid;
          this.row = row;
        }
        this.bgm = window.parent._bgm;
        if (this.bgm) {
          var _path = document.location.pathname.split('t_final.html')[0];
          play($(window.parent.document).find('#vs-bgm')[0], _path + '/mp3/bingo_bgm.mp3');
        }
      });
    },

    computed: {

    },

    data: {
      level: 0,
      grid: 0,
      row: 0,
      bgm: true,
    },

    methods: {
      toHome: function (e) {
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

  handleProgress();

  $(parent.document).find('body').find('.btn_ok').click(function () {
    if ($(parent.document).find('body').find('.pop_box .text').text() == 'Retry?') {
      window.parent._sharedObject._bingoUser = [];
      window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
      setTimeout(function () {
        location.href = 'lottery.html#' + $$main.level + '_' + $$main.grid + '_' + $$main.row;
      }, 300);
    }
  });
});
