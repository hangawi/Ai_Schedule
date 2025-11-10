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

function play(audio, url) {
  return new Promise(function (resolve, reject) { // return a promise
    // var audio = new Audio();                     // create audio wo/ src
    // var audio = $('#audio')[0];                     // create audio wo/ src
    audio.preload = "auto";                      // intend to play through
    audio.autoplay = true;                       // autoplay when loaded
    audio.onerror = reject;                      // on error, reject
    audio.onended = resolve;                     // when done, resolve

    audio.src = url;
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
  window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');

  $(window.parent.document).find('body').append('<audio id="vs-bgm" loop></audio>');
  bgm = $(window.parent.document).find('#vs-bgm')[0];
  if(window.parent._bgm == undefined) {
    window.parent._bgm = true;
  } else {
    window.parent._bgm = false;
  }

  window.globalHandleNotifyCurrentPage(1);
  window.handleProtocol('totalpage', 1);

  parent.document.querySelector('#wrap .t_activity .fel_topad').style.display = 'none';

  setTimeout(function () {
    $(".vs-position-change .md-switch-label").after($(".vs-position-change .md-switch-container"));
    $(".vs-position-change").show();
  }, 100);


  var $main = new Vue({
    el: '#main',

    created: function () {
      $$main = this;

      this.$nextTick(function () {
        // console.log('next tick');
      });
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
      bgm: 1,
      checked: 0,
      level: 0,
      grid: 0,
      row: 0,
    },

    methods: {
      exitBook: function (e) {
        var _tsoc_o;
        if (window.parent.tsoc_o != undefined) {
          _tsoc_o = window.parent.tsoc_o;
        } else {
          _tsoc_o = window.parent.parent.tsoc_o;
        }
        if (_tsoc_o != undefined) _tsoc_o.exitBook();
      },
      moduleClick: function (e) {
        $('.vs-white-button').removeClass('selected');
        $(e.currentTarget).addClass('selected');
        this.checked = $(e.target.parentElement).attr('module');
      },

      levelClick: function (e) {
        this.level = $(e.target.parentElement).attr('value');
        $('.selectLevelBtn').removeClass('selected');
        $(e.target.parentElement).addClass('selected');
        play($('#vs-effect')[0], './mp3/common/common_option_click.mp3');
      },

      gridClick: function (e) {
        this.grid = $(e.target.parentElement).attr('value');
        $('.selectGridBtn').removeClass('selected');
        $(e.target.parentElement).addClass('selected');
        play($('#vs-effect')[0], './mp3/common/common_option_click.mp3');
      },

      rowClick: function (e) {
        this.row = $(e.target.parentElement).attr('value');
        $('.selectRowBtn').removeClass('selected');
        $(e.target.parentElement).addClass('selected');
        play($('#vs-effect')[0], './mp3/common/common_option_click.mp3');
      },

      startApp: function (e) {
        play($('#vs-effect')[0], './mp3/common/common_activity_start.mp3');
        if ($$main.level != 0 && $$main.grid != 0 && $$main.row != 0 && $$main.level != undefined && $$main.grid != undefined && $$main.row != undefined) {
          setTimeout(function () {
            window.parent._bgm = true;
            location.href = 'lottery.html#' + $$main.level + '_' + $$main.grid + '_' + $$main.row;
          }, 500);
        } else {
          this.openAlert('alert');
        }
      },

      openAlert: function (ref) {
        this.$refs[ref].open();
      }
    },

    watch: {
      bgm: function (arg) {
        if (!arg) {
          bgm.pause();
        } else {
          bgm.play();
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
  
});
