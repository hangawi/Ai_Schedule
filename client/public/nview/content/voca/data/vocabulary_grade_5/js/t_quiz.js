var _obj = {}

var _index;

var _stored_list;
var _my_word_list;
var _my_list;

var _direction_of_move;

var _word = 0;

var _ex_count = 0;

var _from = location.href.split('?from=')[1];

var dragId;

var _answer = [];

var wordsData = [];

var _arrCount = [];

var _completedCount = 0;

window.clickable = true;

function numToNDigitStr(num, n) {
  if (num >= Math.pow(10, n - 1)) { return num; }
  return '0' + numToNDigitStr(num, n - 1);
}

function shuffle(array) {
  let currentIndex = array.length, randomIndex;

  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

/*
    Returns the bounding rectangle of a jQuery element
    {x,y,w,h}
*/
function getBounds(el) {
  var pos = el.position();
  return {
    x: pos.left,
    y: pos.top,
    w: el.width(),
    h: el.height()
  };
}

function getRandom(arr, n) {
  var result = new Array(n),
    len = arr.length,
    taken = new Array(len);
  if (n > len)
    throw new RangeError("getRandom: more elements taken than available");
  while (n--) {
    var x = Math.floor(Math.random() * len);
    result[n] = arr[x in taken ? taken[x] : x];
    taken[x] = --len in taken ? taken[len] : len;
  }
  return result;
}

/*
    Checks for overlap on two rectangles
*/
function hitTest(rectA, rectB) {

  var rA = rectA.x + rectA.w; // Right side of rectA
  var rB = rectB.x + rectB.w; // Right side of rectB
  var bA = rectA.y + rectA.h; // Bottom of rectA
  var bB = rectB.y + rectB.h; // Bottom of rectB

  var hitX = rA > rectB.x && rectA.x < rB; // True if hit on x-axis
  var hitY = bA > rectB.y && rectA.y < bB; // True if hit on y-axis

  // Return true if hit on x and y axis
  return hitX && hitY;
}

var $boxA;
var $boxB;

var rectA;
var rectB;

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

function swipeTarget(arg) {
  $$main.currentWord = arg;
}

function getTarget() {
  return $$main.currentWord;
}

function _init_content() {
  xmlData = $(x2js.json2xml(value)).find('lesson');

  wordsData = $(xmlData).parent().find('lesson:eq(' + _index + ')').find('word');
  
  $$main.wordsData = wordsData;

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
      var _definition = $(this).attr('definition');
      _definition = _definition.replaceAll('[]', '<span class="vs-point-color">' + $(this).attr('word') + '</span>');
      _definition = _definition.replaceAll('[|]', '<br/>');

      var _img =
        './assets/images/grade_' + $(this).attr('grade').toLowerCase() + '/module_' + $(this).attr('module') + '/' +
        'topic_' + $(this).attr('topic') + '/' + numToNDigitStr($(this).attr('id'), 3) + '.png';

      var _word_1 = $(this).attr('word');
      var _word_2 = $(this).attr('wrong_1');
      var _word_3 = $(this).attr('wrong_2');
      var _correct = null;

      var _arr = [_word_1, _word_2, _word_3];
      _arr = shuffle(_arr);
      _arr.forEach(function (val, index) {
        if (val == _word_1) {
          _correct = index;
        }
      });
        
      if (isInArray(_id, _stored_list)) {
        arrWords.push({
          word_1: _arr[0],
          word_2: _arr[1],
          word_3: _arr[2],
          correct: _correct,
          definition: _definition,
          img: _img,
          index: __id
        });
        __id++;
      }
      _id++;
    });
  }

  if (arrWords.length >= 5) {
    arrWords = getRandom(arrWords, 5);
  } else {
    arrWords = getRandom(arrWords, arrWords.length);
  }
  
  $$main.wordData = arrWords;
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

function sendFeedback(arg) {
  // console.log(arg);
  if (window.feedback_o == null) {
    window.feedback_o = [];
    for (var i = 0; i < 5; i++) { window.feedback_o[i] = 0; }
  }
  if (window.feedback_x == null) {
    window.feedback_x = [];
    for (var i = 0; i < 5; i++) { window.feedback_x[i] = 0; }
  }

  if (arg.split('_')[0] == 'o') {
    window.feedback_o[Number(arg.split('_')[1])] += 1;
  } else {
    window.feedback_x[Number(arg.split('_')[1])] += 1;
  }
  handleCount();
}

function handleCount() {
  var _o = 0;
  var _x = 0;

  _o = window.feedback_o[$$main.currentWord];
  _x = window.feedback_x[$$main.currentWord];

  $('#vs-count-o span.vs-count').html(_o);
  $('#vs-count-x span.vs-count').html(_x);
}

$(document).ready(function () {

  parent.document.querySelector('#wrap .t_activity .fel_topad').style.display = 'block';
  window.globalHandleNotifyCurrentPage(2);
  window.handleProtocol('totalpage', 2);

  setTimeout(function () {
    $(".vs-position-change .md-switch-label").after($(".vs-position-change .md-switch-container"));
    $(".vs-position-change").show();
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
        if (this.bgm) {
          play($('#vs-bgm')[0], './mp3/vocabulary_bgm.mp3');
        }
      });
    },

    computed: {
      circlePostition() {
        return {
          top: this.posY - 25 + "px",
          left: this.posX - 25 + "px"
        };
      },

      maxPaging: function () {
        return $$main.words.length;
      }
    },

    data: {
      bgm: true,
      x: 0,
      y: 0,
      coordinates: {
        top: "0px",
        left: "0px",
      },
      circle_default_1: {
        top: "80px",
        left: "160px",
      },
      circle_default_2: {
        top: "300px",
        left: "520px",
      },
      circle_default_3: {
        top: "80px",
        left: "880px",
      },
      coordinates_1: { top: "80px", left: "160px", },
      coordinates_2: { top: "300px", left: "520px", },
      coordinates_3: { top: "80px", left: "880px", },

      coordinates_0_1: { top: "80px", left: "160px", },
      coordinates_0_2: { top: "300px", left: "520px", },
      coordinates_0_3: { top: "80px", left: "880px", },

      coordinates_1_1: { top: "80px", left: "160px", },
      coordinates_1_2: { top: "300px", left: "520px", },
      coordinates_1_3: { top: "80px", left: "880px", },

      coordinates_2_1: { top: "80px", left: "160px", },
      coordinates_2_2: { top: "300px", left: "520px", },
      coordinates_2_3: { top: "80px", left: "880px", },

      coordinates_3_1: { top: "80px", left: "160px", },
      coordinates_3_2: { top: "300px", left: "520px", },
      coordinates_3_3: { top: "80px", left: "880px", },

      coordinates_4_1: { top: "80px", left: "160px", },
      coordinates_4_2: { top: "300px", left: "520px", },
      coordinates_4_3: { top: "80px", left: "880px", },
      
      bubbleMenuClickState: false,
      offset: [0, 0],
      
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

      wordsData: [],

      countO: 0,
      countX: 0,
    },

    methods: {
      circleDown(e) {
        if (window.clickable) {
          this.bubbleMenuClickState = true;
          var _x, _y;
          if (e.touches) {
            _x = e.touches[0].pageX; _y = e.touches[0].pageY;
          } else {
            _x = e.clientX; _y = e.clientY;
          }
          this.offset = [
            e.target.offsetLeft - _x,
            e.target.offsetTop - _y
          ];
          dragId = e.target.id.slice(-1);
        }
        
      },
      circleUp(e) {
        if (window.clickable) {
          this.bubbleMenuClickState = false;

          $boxA = $('#slide' + $$main.currentWord + ' .md-card');
          $boxB = $(e.target);
          rectA = getBounds($boxA);
          rectB = getBounds($boxB);

          var _x, _y;
          if (e.changedTouches) {
            _x = e.changedTouches[0].pageX; _y = e.changedTouches[0].pageY;
          } else {
            _x = e.clientX; _y = e.clientY;
          }

          rectB.x = _x - $boxB.width() / 2 - 350;
          rectB.y = _y - $boxB.height() / 2 - 175;

          var hit = hitTest(rectA, rectB);
          var _indicator = $('.md-boards-navigation button.md-board-header')[$$main.currentWord];

          if (hit) {
            var _target = $('#slide' + ($$main.currentWord) + ' .md-card');
            var _correctId = Number($(e.target).attr('correct')) + 1;

            for (var i = 1; i <= 3; i++) {
              if (i != dragId) {
                $('#circle_' + $$main.currentWord + '_' + i).addClass('disabled');
                $('#circle_' + $$main.currentWord + '_' + i).css('cursor', 'default');
              } else {
                $('#circle_' + $$main.currentWord + '_' + i).css('cursor', 'default');
              }
              if (i != _correctId) {
                $('#circle_' + $$main.currentWord + '_' + i).addClass('incorrect');
              }
              $('#circle_' + $$main.currentWord + '_' + i).attr('disabled', 'disabled');
            }

            if (dragId == _correctId) {
              $('#circle_' + $$main.currentWord + '_' + _correctId).addClass('correct');
              $('#circle_' + $$main.currentWord + '_' + dragId).animate({
                left: this['circle_default_' + dragId].left,
                top: this['circle_default_' + dragId].top,
              }, 500);
              play($('#vs-effect')[0], './mp3/correct.mp3');
              
              $(_indicator).attr('feedback', 'right');
              _count_o = $('.md-boards-navigation button.md-board-header[feedback="right"]').length;
              _answer[$$main.currentWord] = 1;
              $('.md-theme-default.md-card').addClass('correct');
            } else {
              $('#circle_' + $$main.currentWord + '_' + dragId).animate({
                left: this['circle_default_' + dragId].left,
                top: this['circle_default_' + dragId].top,
              }, 500);
              $('#circle_' + $$main.currentWord + '_' + _correctId).removeClass('disabled')
              $('#circle_' + $$main.currentWord + '_' + _correctId).addClass('correct');
              play($('#vs-effect')[0], './mp3/wrong.mp3');
              $(_indicator).attr('feedback', 'wrong');
              _count_x = $('.md-boards-navigation button.md-board-header[feedback="wrong"]').length;
              _answer[$$main.currentWord] = 0;
              $('.md-theme-default.md-card').addClass('wrong');
            }

            window.clickable = false;
          } else {
            $('#circle_' + $$main.currentWord + '_' + dragId).animate({
              left: this['circle_default_' + dragId].left,
              top: this['circle_default_' + dragId].top,
            }, 500);
          }
        }
      },
      circleMove(e) {
        if (window.clickable) {
          if (this.bubbleMenuClickState && window.clickable != false) {
            var _x, _y;
            if (e.touches) {
              _x = e.touches[0].pageX; _y = e.touches[0].pageY;
            } else {
              _x = e.clientX; _y = e.clientY;
            }
            if (_x * _y != 0) {
              $('#circle_' + $$main.currentWord + '_' + dragId).css('left', (_x + this.offset[0]) + "px");
              $('#circle_' + $$main.currentWord + '_' + dragId).css('top', (_y + this.offset[1]) + "px");
            }
          }
        }
      },

      fetchData: function () {
        $$main.lessons = arrLessons;
      },

      linkToHome: function () {
        play($('#vs-effect')[0], './mp3/common/0_Common_Click(short).mp3');
        setTimeout(function () {
          window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
          window.handleProtocol('callRetry');
          location.href = 'start.html';
        }, 500);
      },

      titleCallback: function (item) {

        $$main.currentWord = 0;
        $$main.changeWord(0);

        $$main.selectedWords = [];
        
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
        if ($$main.currentWord <= 0) return false;

        var _length = $('.md-boards-navigation button').length;
        $('.md-boards-navigation button')[0].click();
        play($('#vs-effect')[0], './mp3/common/0_Common_Click(short).mp3');
        $('.md-theme-default.md-card').removeClass('correct');
        $('.md-theme-default.md-card').removeClass('wrong');

        handleCount();

        setTimeout(function () {
          if ($('.md-board-header.md-active').attr('feedback') == 'right' || $('.md-board-header.md-active').attr('feedback') == 'wrong') {
            window.clickable = false;
            if ($('.md-board-header.md-active').attr('feedback') == 'right') $('.md-theme-default.md-card').addClass('correct');
            if ($('.md-board-header.md-active').attr('feedback') == 'wrong') $('.md-theme-default.md-card').addClass('wrong');
          } else {
            window.clickable = true;
          }
        }, 200);
      },

      nextCard: function () {
        if ($$main.currentWord + 1 >= arrWords.length) return false;

        var _length = $('.md-boards-navigation button').length;
        $('.md-boards-navigation button')[_length - 1].click();
        play($('#vs-effect')[0], './mp3/common/0_Common_Click(short).mp3');
        $('.md-theme-default.md-card').removeClass('correct');
        $('.md-theme-default.md-card').removeClass('wrong');

        handleCount();

        setTimeout(function () {
          if ($('.md-board-header.md-active').attr('feedback') == 'right' || $('.md-board-header.md-active').attr('feedback') == 'wrong') {
            window.clickable = false;
            if ($('.md-board-header.md-active').attr('feedback') == 'right') $('.md-theme-default.md-card').addClass('correct');
            if ($('.md-board-header.md-active').attr('feedback') == 'wrong') $('.md-theme-default.md-card').addClass('wrong');
          } else {
            window.clickable = true;
          }
        }, 200);
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

      answerClick: function () {
        play($('#vs-effect')[0], './mp3/common/0_Common_Click(short).mp3');
        $('#answer').hide();
        $('.vs-count').show();
      },

      setPaging: function () {
        console.log('paging')
      },
      
      linkToPage: function (ref) {
        play($('#vs-effect')[0], './mp3/common/0_Common_Click(short).mp3');

        setTimeout(function() {
          if (ref == 't_quiz') {
            
          }
          if (ref == 't_word_card') {
            window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
            window.handleProtocol('callRetry');
          }
          location.href = ref + '.html';
        }, 500);
      },

      changeWord: function (arg) {
        $$main.currentWord = arg;
      },

      // 다이얼로그
      openDialog: function (ref, img) {
        this.$refs[ref].open();
        $('.modal-img img').attr('src', img);
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
    },

    watch: {
      paging: function (val) {
        
      },

      bgm: function(arg) {
        play($('#vs-effect')[0], './mp3/click.mp3');
        if(!arg) {
          bgm.pause();
        } else {
          bgm.play();
        }
      },

      currentWord: function (val) {

        $$main.currentWord = val;
        
        var tmp = -(val * $('#app .md-boards').width());
        $('.md-boards-wrapper').attr('style', 'transform: translate3d(' + tmp + 'px, 0px, 0px)');

        $$main.paging = ($$main.currentWord + 1);
      },

      countO: function (val) {
        $('.vs-count-o span.vs-count').html(val);
      }, 
      countX: function (val) {
        $('.vs-count-x span.vs-count').html(val);
      },
    }
  });

  $('.input-group__input > .material-icons.icon.input-group__prepend-icon').hide();

  setTimeout(function() {
    _obj._index = _index;
    _obj._study_list = _my_list;
    _obj.wordsData = $$main.wordData;
    _obj.s_target = 's_quiz.html';

    setTimeout(function() {
      window.handleProtocol('setThreeminInfo', _obj);
    }, 200);
    
  }, 300);

  $(parent.document).find('body').find('.btn_ok').click(function () {
    if ($(parent.document).find('body').find('.pop_box .text').text() == 'Retry?') {
      window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
      setTimeout(function() {
        document.location.reload();
      }, 300);
    }
  });

  $(parent.document).find('body').find('.fel_topad').bind('touchstart click', function () {
    setTimeout(function () {
      _obj.init = true;
      window.handleProtocol('setThreeminInfo', _obj);
    }, 500);
  });

  setTimeout(function() {
    $('.vs-definition p').each(function () {
      if ($(this).height() > 200) {
        $(this).css('font-size', '20px');
      }
    });
    $('.circle-drag.vs-text').each(function () {
      var _length = $(this).text().length;
      var _font_size = 28;
      var _line_height = 1;
      if (_length > 10) { _font_size = 22; _line_height = 1; }
      if (_length > 20) { _font_size = 21; _line_height = 1; }
      if (_length > 30) { _font_size = 19; _line_height = 1.2; }
      if (_length > 40) { _font_size = 18; _line_height = 1.2; }
      $(this).css('font-size', _font_size + 'px');
      $(this).css('line-height', _line_height + 'em');
    });
  }, 300);
});
