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

function fnToForceAttention() {
  document.location.href = "attention.html";
}

function fnToAttention() {
  window.handleProtocol('callThreeminInfo', 'handleBuzzeredUserSync');
  setTimeout(function () {
    if (window.parent._sharedObject.firstBuzzerUser != null) {
      if (window.parent._sharedObject.user_opened.id != window.parent._studentId.id && window.parent._sharedObject.buzzeredUser.id != window.parent._studentId.id) {
        document.location.href = 'attention.html';
      } else if (window.parent._sharedObject.user_opened.id != window.parent._studentId.id && window.parent._sharedObject.buzzeredUser.id == window.parent._studentId.id) {
        location.href = "s_answer.html";
      } else {
        document.location.href = 'attention.html';
      }
    } else {
      document.location.href = 'attention.html';
    }
  }, 500);
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
      window.parent.hitBuzzed = true;
    },

    mounted: function () {
      setTimeout(function () {
        window.handleProtocol('callThreeminInfo', 'handleBuzzeredUserSync');
        setTimeout(function () { if (window.parent._sharedObject.firstBuzzerUser != undefined) { if (window.parent._sharedObject.buzzeredUser.id != window.parent._studentId.id && window.parent._sharedObject.firstBuzzerUser != null) { document.location.href = 'attention.html'; } } }, 1500);
      }, 500);
      setTimeout(function () {
        window.handleProtocol('callThreeminInfo', 'handleBuzzeredUserSync');
        setTimeout(function () { if (window.parent._sharedObject.firstBuzzerUser != undefined) { if (window.parent._sharedObject.buzzeredUser.id != window.parent._studentId.id && window.parent._sharedObject.firstBuzzerUser != null) { document.location.href = 'attention.html'; } } }, 1500);
      }, 2000);
      setTimeout(function () {
        window.handleProtocol('callThreeminInfo', 'handleBuzzeredUserSync');
        setTimeout(function () { if (window.parent._sharedObject.firstBuzzerUser != undefined) { if (window.parent._sharedObject.buzzeredUser.id != window.parent._studentId.id && window.parent._sharedObject.firstBuzzerUser != null) { document.location.href = 'attention.html'; } } }, 1500);
      }, 3500);
      setTimeout(function () {
        window.handleProtocol('callThreeminInfo', 'handleBuzzeredUserSync');
        setTimeout(function () { if (window.parent._sharedObject.firstBuzzerUser != undefined) { if (window.parent._sharedObject.buzzeredUser.id != window.parent._studentId.id && window.parent._sharedObject.firstBuzzerUser != null) { document.location.href = 'attention.html'; } } }, 1500);
      }, 5500);
      setTimeout(function () {
        window.handleProtocol('callThreeminInfo', 'handleBuzzeredUserSync');
        setTimeout(function () { if (window.parent._sharedObject.firstBuzzerUser != undefined) { if (window.parent._sharedObject.buzzeredUser.id != window.parent._studentId.id && window.parent._sharedObject.firstBuzzerUser != null) { document.location.href = 'attention.html'; } } }, 1500);
      }, 7000);
      setTimeout(function () {
        window.parent.hitBuzzed = false;
      }, 500);
    },

    computed: {
    },

    data: {
      bgm: true,
    },

    methods: {
      buzzerClick: function (e) {
        if (window.parent.hitBuzzed == true) return false;
        window.parent.hitBuzzed = true;
        play($('#vs-effect')[0], './mp3/buzzer_student.mp3');
        var _obj = window.parent._sharedObject;
        _obj.buzzeredUser = window.parent._studentId;

        window.handleProtocol('setThreeminInfo', _obj);
        setTimeout(function () { window.handleProtocol('callThreeminInfo', 'handleBuzzerClicked'); }, 10);

        // setTimeout(function (e) {
        //   location.href = "s_answer.html";
        // }, 700);
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

});
