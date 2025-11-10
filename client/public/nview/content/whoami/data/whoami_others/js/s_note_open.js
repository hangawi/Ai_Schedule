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
  $$main.currentWord = arg;
}

function getTarget() {
  return $$main.currentWord;
}

function fnToQuestion() {

}

function fnToBuzzer() {

}

function fnToAttention() {

}

function fnForceToAttention() {

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
      this.word = window.parent._sharedObject.activityData[window.parent._sharedObject.correct];
      this.$nextTick(function () {
        setTimeout(function () {
          $('#svg_img').hide();
          $('#vs-interaction').show();
        }, 1500);

        play($('#vs-effect')[0], './mp3/hint.mp3');
      });
    },

    computed: {

    },

    data: {
      bgm: true,
      word: [],
    },

    methods: {
      toHome: function (e) {
      },
      toQuestion: function (e) {
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
});
