var _index;

var bgm;

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

function fnToAttention() {
  document.location.href = 'attention.html';
}

function fnToNote() {
  document.location.href = 'attention.html';
}

function _init_content() {

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
    },

    mounted: function () {
      this.$nextTick(function () {
        setTimeout(function() {
          $('#svg_img').hide();
          $('#vs-button').show();
        }, 1500);
        
        play($('#vs-effect')[0], './mp3/note_receive.mp3');
      });
    },

    computed: {

    },

    data: {
      bgm: true,
    },

    methods: {
      noteClick: function (e) {
        play($('#vs-effect')[0], './mp3/note_open.mp3');
        setTimeout(function(e) {
          window.handleProtocol('callThreeminInfo', 'goNextPage');
          location.href = "s_note_open.html";
        }, 700);
      },
      toHome: function (e) {
      },
    },

    watch: {
      bgm: function (arg) {
        play($('#vs-effect')[0], './mp3/click.mp3');
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

  setTimeout(function () {
    var _obj = window.parent._sharedObject;
    window.handleProtocol('setThreeminInfo', _obj);
  }, 300);
});
