var _index;

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

function fnForceToAttention() {
  if (window.parent._sharedObject.user_opened.id != window.parent._studentId.id) {
    document.location.href = 'attention.html';
  }
}

function fnToAttention() {
  if (window.parent._sharedObject.user_opened.id != window.parent._studentId.id) {
    if (window.parent._sharedObject.firstBuzzerUser.id != window.parent._studentId.id) {
      document.location.href = 'attention.html';
    }
  }
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
      this.activityData = window.parent._sharedObject.activityData;
      this.correct = window.parent._sharedObject.correct;
      if (window.parent._sharedObject.user_opened.id != window.parent._studentId.id && window.parent._sharedObject.buzzeredUser.id != window.parent._studentId.id) {
        document.location.href = 'attention.html';
      }
    },

    computed: {
    },

    data: {
      bgm: true,
      activityData: [],
      correct: null,
    },

    methods: {
      questionClick: function (e) {
        var userAnswer = $(e.currentTarget).attr('check');
        if (userAnswer == (this.correct + 1)) {
          play($('#vs-effect')[0], './mp3/answerer.mp3');
          $('#feedback').show();
          var _obj = window.parent._sharedObject;
          _obj.correctUser = window.parent._studentId;
          window.handleProtocol('setThreeminInfo', _obj);
          
          setTimeout(function() {
            window.handleProtocol('callThreeminInfo', 'handleAnswerCorrect');
          }, 2500);
          setTimeout(function (e) {
            $('#particle').css('z-index', '9999');
            $('#particle').attr('src', 'https://raw.githubusercontent.com/graykara/files/main/aniEffectResult_Popup.gif');
            for(var i = 0; i < Number(window.parent._sharedObject.s_length); i++) {
              window.handleProtocol('completed');
            }
          }, 500);
        } else {
          play($('#vs-effect')[0], './mp3/wrong.mp3');
          $('#feedback').show();
          $('#feedback_wrong').css('display', 'block');

          window.handleProtocol('callThreeminInfo', 'handleAnswerWrong');
        }
      }
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
