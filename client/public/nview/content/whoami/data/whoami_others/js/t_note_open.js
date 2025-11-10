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

var openInterval;

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

function goNextPage() {
  document.location.href = 't_board.html';
}

$(document).ready(function () {
  // $('.md-tabs-content').remove();

  // var $loader = new Vue({
  //   el: '#loader',
  // });

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
        // if (this.bgm) {
        //   play($(window.parent.document).find('#vs-bgm')[0], './mp3/whoami_bgm.mp3');
        // }
      });
    },

    computed: {

    },

    data: {
      bgm: true,
    },

    methods: {
      toHome: function (e) {
        window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
        window.handleProtocol('callRetry');
        window.parent._sharedObject = null;
        window.parent._bgm = false;
        location.href = 'start.html';
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

  $('#oImg').css('opacity', 0);

  var openCount = 0;
  clearInterval(openInterval);
  openInterval = setInterval(function () {
    if (window.parent._sharedObject != undefined) {
      if (window.parent._sharedObject.user_opened != undefined) clearInterval(openInterval);

      var _user_opened = window.parent._sharedObject.user_opened;
      var _displayMode = Number(_user_opened.displayMode);
      var _oImg, _oName;
      if (_displayMode == 1) {
        _oImg = _user_opened.thumb;
        _oName = _user_opened.name;
        if (_user_opened.name == '') _oName = _user_opened.nickname;
      } else {
        _oImg = _user_opened.avatar;
        _oName = _user_opened.nickname;
        if (_user_opened.nickname == '') _oName = _user_opened.name;
      }

      if (_oImg != '') {
        $('#oImg').attr('src', _oImg);
        $('#oImg').css('opacity', 1);
        $('#oImg').fadeIn();
      } else {
        var iName = _oName.substr(0, 2).toUpperCase();
        var iGender = _user_opened.gender;
        if (_user_opened.gender == undefined || _user_opened.gender == '' || _user_opened.gender.toUpperCase() == 'M') {
          iGender = 'male';
        } else if (_user_opened.gender.toUpperCase() == 'F') {
          iGender = 'female';
        }
        $('#oImg').remove();
        $('#imgArea').append('<div class="iName ' + iGender + '">' + iName + '</div>');
      }
      $('#oName').text(_oName);
    }

    if (openCount > 100) clearInterval(openInterval);

    openCount++;
  }, 100);



  $(parent.document).find('body').find('.btn_ok').click(function () {
    window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
    if ($(parent.document).find('body').find('.pop_box .text').text() == 'Retry?') {
      setTimeout(function () {
        // document.location.reload();
        window.loadPage('t_note.html');
      }, 300);
    }
  });
});
