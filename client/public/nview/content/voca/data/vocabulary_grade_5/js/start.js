var bgm;
var $$main;

function play(audio, url) {
  return new Promise(function (resolve, reject) { // return a promise
    // var audio = new Audio();                     // create audio wo/ src
    // var audio = $('#audio')[0];                     // create audio wo/ src
    audio.preload = "auto";                      // intend to play through
    audio.autoplay = true;                       // autoplay when loaded
    audio.onerror = reject;                      // on error, reject
    audio.onended = resolve;                     // when done, resolve
    audio.src = url;
    if (url.indexOf('bgm') > 0) bgm = audio;
    audio.play();
  });
}

$(document).ready(function() {
  window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');

  window.globalHandleNotifyCurrentPage(1);
  window.handleProtocol('totalpage', 2);

  parent.document.querySelector('#wrap .t_activity .fel_topad').style.display = 'none';
  
  var $main = new Vue({
    el: '#main',

    data: {
      lessons: arrLessons
    },

    created: function() {
      $$main = this;
      
      init();

      this.$nextTick(function() {
        console.log('next tick');
      });
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
      openTopic: function(index, topic) {
        __store.set('lesson_index', index);
        wordsData = $(x2js.json2xml(value)).find('lesson:eq(' + index + ')').find('word');
        var _list = [];
        for (var i = 0; i < wordsData.length; i++) {
          if (Number($(wordsData[i]).attr('topic')) == topic) {
            _list.push(i);
          }
        }
        __store.set(index + '_study_list', _list);
        play($('#vs-effect')[0], './mp3/common/common_option_click.mp3');
        window.parent._topic = topic;
        setTimeout(function () {
          location.href = "./t_word_card.html";
        }, 500);
      },

      selectTitle: function(index) {
        __store.set('lesson_index', index);
        wordsData = $(x2js.json2xml(value)).find('lesson:eq(' + index + ')').find('word');
        var _list = [];
        for (var i = 0; i < wordsData.length; i++) {
          if (Number($(wordsData[i]).attr('topic')) == topic) {
            _list.push(i);
          }
        }
        __store.set(index + '_study_list', _list);
        play($('#vs-effect')[0], './mp3/common/common_option_click.mp3');
        setTimeout(function () {
          location.href = "./t_word_card.html";
        }, 500);
      },

      toggleLeftSidenav: function() {
        this.$refs.leftSidenav.toggle();
      },
      closeLeftSidenav: function() {
        this.$refs.leftSidenav.close();
      },

      fnSideWordList: function() {
        location.href = 't_word_card.html';
      },

      fnSideHelp: function() {
        // alert('help');
        location.href = 'help.html';
      },

      linkToPage: function(ref) {
        play($('#vs-effect')[0], './mp3/common/0_Common_Click(short).mp3');
        setTimeout(function () {
          location.href = ref + ".html";
        }, 500);
      },

      open: function(ref) {
        console.log('Opened: ' + ref);
      },
      close: function(ref) {
        console.log('Opened: ' + ref);
      },
    }
  });
});
