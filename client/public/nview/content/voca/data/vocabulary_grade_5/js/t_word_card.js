var _index;

var _stored_list;
var _my_word_list;
var _my_list;

var _direction_of_move;

var _word = 0;

var _ex_count = 0;

var _from = location.href.split('?from=')[1];

var _text_1, _text_2, _text_3;

if (__store.get('lesson_index') !== 'undefined') {
  _index = __store.get('lesson_index');
  
  if (__store.get(_index + '_study_list') !== undefined && __store.get(_index + '_study_list') !== null) {
    _stored_list = __store.get(_index + '_study_list');
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
  console.log('err')
}

function numToNDigitStr(num, n) {
  if (num >= Math.pow(10, n - 1)) { return num; }
  return '0' + numToNDigitStr(num, n - 1);
}

function swipeTarget(arg) {
  $$main.currentWord = arg;
}

function getTarget() {
  return $$main.currentWord;
}

function _init_content() {
  xmlData = $(x2js.json2xml(value)).find('lesson');

  wordsData = $(x2js.json2xml(value)).find('lesson:eq(' + _index + ')').find('word');

  var listLength = wordsData.length;

  $$main.lesson_title = $(xmlData[_index]).attr('name');
  
  if (xmlData) {
    $(xmlData).each(function () {
      arrLessons.push({ index: $(this).attr('index'), name: getName($(this).attr('name')) });
    });
  }
  
  if (listLength) {
    var _id = 0;
    var __id = 0;

    $(wordsData).each(function () {

      if (isInArray(_id, _stored_list)) {
        var _definition = $(this).attr('definition');
        _definition = _definition.replaceAll('[]', '<span class="vs-point-color">' + $(this).attr('word') + '</span>');
        _definition = _definition.replaceAll('[|]', '<br/>');

        var _img = 
          'grade_' + $(this).attr('grade').toLowerCase() + '/module_' + $(this).attr('module') + '/' +
          'topic_' + $(this).attr('topic') + '/' + numToNDigitStr($(this).attr('id'), 3) + '.png';

        arrWords.push({
          word: '<div class="vs-data">' + $(this).attr('word') + '</div>',
          wrong_1: $(this).attr('wrong_1'),
          wrong_2: $(this).attr('wrong_2'),
          definition: '<div class="vs-data">' + _definition + '</div>',
          img: '<img src="./assets/images/' + _img + '"/>',
          index: __id
        });
        __id++;
      }
      _id++;
    });
  }

  $$main.wordData = arrWords;

  (__store.get('settings1') === undefined) ? $$main.settings1 = true : $$main.settings1 = __store.get('settings1');
  (__store.get('settings2') === undefined) ? $$main.settings2 = true : $$main.settings2 = __store.get('settings2');
  (__store.get('settings3') === undefined) ? $$main.settings3 = true : $$main.settings3 = __store.get('settings3');
  (__store.get('settings4') === undefined) ? $$main.settings4 = true : $$main.settings4 = __store.get('settings4');
}

var bgm;

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

$(document).ready(function () {

  parent.document.querySelector('#wrap .t_activity .fel_topad').style.display = 'none';

  setTimeout(function () {
    $(".vs-position-change .md-switch-label").after($(".vs-position-change .md-switch-container"));
    $(".vs-position-change").show();

    window.globalHandleNotifyCurrentPage(2);
    window.handleProtocol('totalpage', 3);
  }, 100);

  var $main = new Vue({
    el: '#main',

    created: function () {

      $$main = this;

      if (value !== undefined) {
        _init_content();
      } else {
        init();
        sleep(100);
        _init_content();
      }

      this.$nextTick(function () {
        setTimeout(function () {
          $$main.titleCallback(_index);
          $$main.currentWord = 0;
        }, 100);
      });
    },

    mounted: function () {

      this.$nextTick(function () {
        
      });
    },

    computed: {
      maxPaging: function () {
        return $$main.words.length;
      }
    },

    data: {
      // volume: 100,
      bgm: true,
      showDialog: false,
      boolean_1: true,
      boolean_2: true,
      boolean_3: true,
      paging: 1,
      lessons: arrLessons,
      lesson_title: '',

      // 단어리스트
      currentWord: 0,
      pages: [],
      words: arrWords,
      selectedWords: [],

      // 자동완성
      wordValue: '',
      wordData: [{ name: '' }],

      settings1: true,
      settings2: true,
      settings3: true,
      settings4: true,
    },

    methods: {
      fetchData: function () {
        $$main.lessons = arrLessons;
      },

      linkToHome: function () {
        play($('#vs-effect')[0], './mp3/common/0_Common_Click(short).mp3');
        setTimeout(function() {
          window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
          window.handleProtocol('callRetry');
          location.href = 'start.html';
        }, 500);
      },

      titleCallback: function (item) {
        $$main.lesson_title = $(xmlData[item]).attr('name');

        _index = item;

        if (__store.get(_index + '_my_word_book') !== undefined && __store.get(_index + '_my_word_book').length > 0 && _from === 'my_word') {
          items = __store.get(_index + '_my_word_book').sort();
          _my_list = __store.get(_index + '_my_word_book');
        } else {
          _stored_list = __store.get(_index + '_study_list');
          _my_list = _stored_list;
        }

        $$main.currentWord = 0;
        $$main.changeWord(0);

        selected_items = null;

        $$main.selectedWords = [];

        $$main.lesson_title = $(xmlData[item]).attr('name');

        wordsData = $(xmlData[item]).find('word');

        var listLength = wordsData.length;

        if (listLength) {
          var _id = 0;
          var __id = 0;
          arrWords = [];
          wordData = [];

          $(wordsData).each(function () {
            if (isInArray(_id, _my_list)) {
              var _definition = $(this).attr('definition');
              _definition = _definition.replaceAll('[]', '<span class="vs-point-color">' + $(this).attr('word') + '</span>')
              _definition = _definition.replaceAll('[|]', '<br/>')

              var _img =
                'grade_' + $(this).attr('grade').toLowerCase() + '/module_' + $(this).attr('module') + '/' +
                'topic_' + $(this).attr('topic') + '/' + numToNDigitStr($(this).attr('id'), 3) + '.png';

              arrWords.push({
                word: '<div class="vs-data">' + $(this).attr('word') + '</div>',
                wrong_1: $(this).attr('wrong_1'),
                wrong_2: $(this).attr('wrong_2'),
                definition: '<div class="vs-data">' + _definition + '</div>',
                img: '<img src="./assets/images/' + _img + '"/>',
                index: __id
              });
              __id++;
            }
            _id++;
          });
          $$main.words = arrWords;
          if (arrWords.length === 1) {
            $('.md-boards .md-board').css('background-image', 'none');
          }
        }

        $$main.wordData = arrWords;

        setTimeout(function () {
          $('.word-eng').each(function () {
            $(this).textfill1({
              maxFontPixels: 140
            })
          });
          $('.word-kor').each(function () {
            $(this).textfill1({
              maxFontPixels: 60
            })
          });
          $('.ex-eng').each(function () {
            $(this).textfill1({
              maxFontPixels: 80
            })
          });
          $('.colored').each(function () {
            $(this).textfill1({
              maxFontPixels: 80
            })
          });
          $('.ex-kor').each(function () {
            $(this).textfill1({
              maxFontPixels: 80
            })
          });
        }, 0);
        
        $('button.md-board-header').attr('disabled', true);

        $('nav button:first()').click(function () {
          if ($$main.currentWord > 0) {
            $$main.currentWord--;
          }
        });

        $('nav button:last()').click(function () {
          if ($$main.currentWord < arrWords.length - 1) {
            $$main.currentWord++;
          }
        });
      },

      prevCard: function () {
        play($('#vs-effect')[0], './mp3/common/0_Common_Click(short).mp3');
        var _length = $('.md-boards-navigation button').length;
        $('.md-boards-navigation button')[0].click();
      },

      nextCard: function () {
        play($('#vs-effect')[0], './mp3/common/0_Common_Click(short).mp3');
        var _length = $('.md-boards-navigation button').length;
        $('.md-boards-navigation button')[_length - 1].click();
      },

      toggleLeftSidenav: function () {
        this.$refs.leftSidenav.toggle();
      },
      closeLeftSidenav: function () {
        this.$refs.leftSidenav.close();
      },

      open: function (ref) {
        console.log('Opened: ' + ref);
      },
      close: function (ref) {
        console.log('Opened: ' + ref);
      },

      wordCallback: function (item) {
        $('#app').scrollTo(item.index * 80, 1000);
      },

      navClick: function () {
        console.log('test!!!!!!');
      },

      setPaging: function () {
        console.log('paging')
      },

      fnSideWordList: function () {
        location.href = 'list.html';
      },

      fnSideWordBook: function () {
        location.href = 'my_word_book.html';
      },

      fnSideHelp: function () {
        location.href = 'help.html';
      },

      linkToPage: function (ref) {
        play($('#vs-effect')[0], './mp3/common/0_Common_Click(short).mp3');
        setTimeout(function () {
          if (ref == 't_quiz') {
          }
          if (ref == 'word_card') {
          }
          location.href = ref + '.html';
        }, 500);
      },

      changeWord: function (arg) {
        $$main.currentWord = arg;
      },

      // 다이얼로그
      openDialog: function (ref, img) {
        if(ref == 'settings') {
          play($('#vs-effect')[0], './mp3/show_hide.mp3');
          this.$refs[ref].open();
        }
        if(ref == 'bigImage') {
          this.$refs[ref].open();
          var _img = img.split('"')[1].split('"')[0];
          $('.modal-img img').attr('src', _img);
        }
      },
      closeDialog: function (ref) {
        this.$refs[ref].close();
      },
      onOpen: function () {
        console.log('Opened');
      },
      onClose: function (type) {
        console.log('Closed', type);
      },

      setting: function(e) {
        var value = $(e.target).attr('value');
        if (this['boolean_' + value]) {
          $(e.target).addClass('selected');
          this['boolean_' + value] = false;
        } else {
          $(e.target).removeClass('selected');
          this['boolean_' + value] = true;
        }
      },
    },

    watch: {
      showDialog: function(e) {

      },

      paging: function (val) {
        // _audio.volume = val / 100;
        // $$main.currentWord = val - 1;
      },

      currentWord: function (val) {
        $$main.currentWord = val;
        // $$main.currentWord = val;
        // var tmp = -(val * 720);
        var tmp = -(val * $('#app .md-boards').width());
        $('.md-boards-wrapper').attr('style', 'transform: translate3d(' + tmp + 'px, 0px, 0px)');

        $$main.paging = ($$main.currentWord + 1);
      },

      boolean_1: function (val) {
        play($('#vs-effect')[0], './mp3/show_hide.mp3');
        if(_text_1 == undefined) {
          _text_1 = $('.attr_1').html();
        }
        if(val) {
          $('.attr_1').parent().css('background-color', '#fff');
          $('.attr_1 > .vs-data').css('opacity', '1');
          $('.attr_1 > .vs-data').css('display', 'block');
          $('.attr_1 .vs-question').remove();
          $('.attr_1').parent().find('.vs-section').css('color', '#666');
         } else {
          $('.attr_1 > .vs-data').css('opacity', '0');
          $('.attr_1 > .vs-data').css('display', 'none');
          $('.attr_1').prepend('<span class="vs-question">?</span>')
          $('.attr_1').parent().css('background-color', '#FF9B20');
          $('.attr_1').parent().find('.vs-section').css('color', '#fff');
         } 
      },

      boolean_2: function (val) {
        play($('#vs-effect')[0], './mp3/show_hide.mp3');
        if(_text_2 == undefined) {
          _text_2 = $('.attr_2').html();
        }
        if(val) {
          $('.attr_2').parent().css('background-color', '#fff');
          $('.attr_2 > .vs-data').css('opacity', '1');
          $('.attr_2 > .vs-data').css('display', 'block');
          $('.attr_2 .vs-question').remove();
          $('.attr_2').parent().find('.vs-section').css('color', '#666');
         } else {
          $('.attr_2 > .vs-data').css('opacity', '0');
          $('.attr_2 > .vs-data').css('display', 'none');
          $('.attr_2').prepend('<span class="vs-question">?</span>')
          $('.attr_2').parent().css('background-color', '#FF9B20');
          $('.attr_2').parent().find('.vs-section').css('color', '#fff');
         } 
      },

      boolean_3: function (val) {
        play($('#vs-effect')[0], './mp3/show_hide.mp3');
        if(_text_3 == undefined) {
          _text_3 = $('.attr_3').html();
        }
        if(val) {
          $('.attr_3').parent().css('background-color', '#fff');
          $('.attr_3 > .vs-data').css('opacity', '1');
          $('.attr_3 > .vs-data').css('display', 'block');
          $('.attr_3 .vs-question').remove();
          $('.attr_3').parent().find('.vs-section').css('color', '#666');
         } else {
          $('.attr_3 > .vs-data').css('opacity', '0');
          $('.attr_3 > .vs-data').css('display', 'none');
          $('.attr_3').prepend('<span class="vs-question">?</span>')
          $('.attr_3').parent().css('background-color', '#FF9B20');
          $('.attr_3').parent().find('.vs-section').css('color', '#fff');
         } 
      },

      settings1: function (val) {
        
      },
      settings2: function (val) {
        
      },
      settings3: function (val) {
        
      },
      settings4: function (val) {
        
      },
    }
  });
  
  $('.attr_1 .vs-data').each(function() {
    if($(this).height() > 216) {
      $(this).css('font-size', '40px');
    }
  });
});
