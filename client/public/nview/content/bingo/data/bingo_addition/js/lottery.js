var _obj = {};

var clickable = false;
var _enabled = false;

var _arrIdx = 0;
var _defaultArr = [];

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

var _active_color = null;

var _completedCount = 0;

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

function numToNDigitStr(num, n) {
  if (num >= Math.pow(10, n - 1)) { return num; }
  return '0' + numToNDigitStr(num, n - 1);
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

function _init_content() {

  if (document.location.hash) {
    var hash = document.location.hash.split('_');

    var level = hash[0].split('#')[1];
    var grid = hash[1];
    var row = hash[2];

    this.level = level;
    this.grid = grid;
    this.row = row;

    _obj.level = this.level;
    _obj.grid = this.grid;
    _obj.row = this.row;
  }

  if (this.level == 'easy') {
    xmlData = $(x2js.json2xml(value)).find('lesson')[0];
  } else {
    xmlData = $(x2js.json2xml(value)).find('lesson')[1];
  }

  wordsData = $($(xmlData)).find('item');
  window._arr = $($(xmlData)).find('item');

  wordsData = getRandom(wordsData, this.grid * this.grid);

  $$main.wordsData = wordsData;

  var listLength = wordsData.length;

  if (listLength > 0) {
    arrWords = [];
    wordData = [];

    var _id = 0;
    var __id = 0;

    $(wordsData).each(function () {
      var _equation = $(this).attr('equation');
      var _answer = $(this).attr('answer');
      // var _img = './assets/images/' + $$subject + '/' + $(this).attr('module') + '/' + $(this).attr('shapes') + '-' + numToNDigitStr($(this).attr('no'), 2) + '.png';
      arrWords.push({
        equation: _equation,
        answer: _answer,
        index: __id,
      });
      __id++;
    });
    _id++;
  }

  $$main.wordData = arrWords;

  $$main.word = { equation: 0 };
  _defaultArr = arrWords.map((x) => x);

  _obj.answer = $$main.word.answer;

  _obj._index = _index;
  _obj._study_list = _my_list;

  setTimeout(function () {
    _obj.s_target = 'attention.html';
    _obj.activityData = arrWords;

    setTimeout(function () {
      window.handleProtocol('setThreeminInfo', _obj);
    }, 200);
  }, 300);
}

function checkComplete() {
  // console.log('complete');
}

var _timeouts = [];
var _x = [40, 120, 200, 270, 110, 190, 260, 30, 50, 280];
var _y = [250, 290, 260, 210, 200, 170, 120, 160, 240, 250];
var canvas = {
  element: document.getElementById('canvas'),
  width: 420,
  height: 420,
  initialize: function () {
    this.element.style.width = this.width + 'px';
    this.element.style.height = this.height + 'px';
    this.element.style.borderRadius = '50%';
    document.body.appendChild(this.element);
  }
};

var Ball = {
  create: function (color, dx, dy) {
    var newBall = Object.create(this);
    newBall.dx = dx;
    newBall.dy = dy;
    newBall.width = 90;
    newBall.height = 90;
    newBall.element = document.createElement('div');
    newBall.element.style.background = 'transparent url(./assets/img/ball_' + color + '.png) no-repeat 0 0';
    newBall.element.style.width = '90px';
    newBall.element.style.height = '90px';
    newBall.element.className += ' ball';
    newBall.width = parseInt(newBall.element.style.width);
    newBall.height = parseInt(newBall.element.style.height);
    canvas.element.appendChild(newBall.element);
    return newBall;
  },
  moveTo: function (x, y) {
    this.element.style.left = x + 'px';
    this.element.style.top = y + 'px';
  },
  changeDirectionIfNecessary: function (x, y) {
    if (x - this.width / 2 < 0 || x > canvas.width - this.width - this.width / 2) {
      this.dx = -this.dx;
    }
    if (y - this.height / 2 < 0 || y > canvas.height - this.height - this.height / 2) {
      this.dy = -this.dy;
    }
  },
  draw: function (x, y) {
    this.moveTo(x, y);
    var ball = this;
    _timeouts.push(setTimeout(function () {
      ball.changeDirectionIfNecessary(x, y);
      ball.draw(x + ball.dx, y + ball.dy);
    }, 1000 / 60));
  }
};

canvas.initialize();
var ball1 = Ball.create("green_m", 15, 8);
var ball2 = Ball.create("pink_m", 10, 7);
var ball3 = Ball.create("yellow_m", 14, 18);
var ball4 = Ball.create("white_m", 17, 9);
var ball5 = Ball.create("blue_m", 14, 11);
var ball6 = Ball.create("green_m", 26, 8);
var ball7 = Ball.create("pink_m", 13, 20);
var ball8 = Ball.create("yellow_m", 9, 7);
var ball9 = Ball.create("white_m", 11, 13);
var ball10 = Ball.create("blue_m", 13, 11);

var bezier_params = {
  start: {
    x: 840,
    y: 520,
    angle: 10
  },
  end: {
    x: 200,
    y: 320,
    angle: -10,
    length: 0.25
  }
};

function setBall() {
  $$main.word = getRandom($$main.wordData, 1)[0];
  _arrIdx = $$main.wordData.indexOf($$main.word);
  $$main.wordData.splice(_arrIdx, 1);
  this.word = $$main.word;

  if ($$main.wordData.length == 0) {
    var listLength = wordsData.length;

    if (listLength > 0) {
      arrWords = [];
      wordData = [];

      var _id = 0;
      var __id = 0;

      $(wordsData).each(function () {
        var _equation = $(this).attr('equation');
        var _answer = $(this).attr('answer');
        arrWords.push({
          equation: _equation,
          answer: _answer,
          index: __id,
        });
        __id++;
      });
      _id++;
    }

    _defaultArr = arrWords;

    $$main.wordData = _defaultArr;
  }

  _obj.answer = $$main.word.answer;

  window.handleProtocol('setThreeminInfo', _obj);
}

function drawBalls() {
  ball1.draw(100, 200);
  ball2.draw(150, 200);
  ball3.draw(200, 150);
  ball4.draw(140, 200);
  ball5.draw(230, 100);
  ball6.draw(200, 130);
  ball7.draw(160, 170);
  ball8.draw(190, 120);
  ball9.draw(160, 170);
  ball10.draw(190, 120);
  setTimeout(function () {
    setTimeout(function () {
      for (var i = 0; i < $('.ball').length; i++) {
        $($('.ball')[i]).animate({ left: _x[i] }, 400);
        $($('.ball')[i]).animate({ top: _y[i] }, 400);
      }
    }, 500);
    setTimeout(function () {
      for (var i = 0; i < _timeouts.length; i++) {
        clearTimeout(_timeouts[i]);
      }
      $('#ball').addClass('rotate');
      // $('#ball').show().animate({ left: 800, top: 520 }, 500).animate({ left: 200, top: 520 }, 500).animate({ left: 200, top: 320 }, 100);

      var path = {
        start: {
          x: 840,
          y: 590,
          angle: 358.729,
          length: 0.329
        },
        end: {
          x: 340,
          y: 380,
          angle: 54.515,
          length: 0.453
        }
      };

      $('#ball').show().animate({ left: 840, top: 590 }, 400).animate({ path: new $.path.bezier(path) }, 700)

      _timeouts = [];

      play($('#vs-effect')[0], './mp3/effect/bingo_ball.mp3');
      setTimeout(function () {
        play($('#vs-effect')[0], './mp3/effect/bingo_ball_open.mp3');
        $('#ball').removeClass('rotate');
      }, 800);
    }, 900);
  }, 1000);

  setTimeout(function () {
    $('#lottie_1').fadeIn();
    $('#lottie_2').fadeIn();
    $('#lottie_1')[0].stop();
    $('#lottie_2')[0].stop();
    $('#lottie_1')[0].play();
    $('#lottie_2')[0].play();
    setTimeout(function () {
      $('#lottie_1').fadeOut();
      $('#lottie_2').fadeOut();
      _playing = false;
    }, 2000);
  }, 3000);

  setTimeout(function () {
    $('#gacha').show();
    $('#gacha').css('background-image', 'url(./assets/img/' + _active_color + '_big.png)')
    $('#ball').hide();

    setTimeout(function () {
      window.handleProtocol('callThreeminInfo', 'handleEnableGame');
    }, 500);
  }, 3000);
  play($('#vs-effect')[0], './mp3/effect/bingo_roulette.mp3');
}

function handleProgress() {
  _completedCount++;

  if (window.parent._bingoUser.length == 0) window.parent._bingoUser = window.parent._sharedObject._bingoUser;
  window.parent._sharedObject._bingoUser.forEach(function (user) {
    if (user.isBingo == true) {
      window.parent._bingoUser.forEach(function (pUser) {
        if (pUser.id == user.id) {
          pUser.isBingo = true;
        }
      });
    }
  });

  setTimeout(function () {
    document.location.href = "t_final.html#" + this.level + '_' + this.grid + '_' + this.row;
  }, 2000);
}

var objInterval;

window.forced = false;

function handleForceInfo() {
  window.handleProtocol('setThreeminInfo', _obj);
}

function handleReady() {
  window.r_length++;
  if (objInterval) { clearInterval(objInterval); }
  objInterval = setInterval(function () {
    if (window.r_length >= _obj.s_length) {
      if (window.forced == false) {
        window.handleProtocol('setThreeminInfo', _obj);
        window.handleProtocol('callThreeminInfo', 'handleForceEnableGame');
        window.forced = true;
        clearInterval(objInterval);
      }
    } else {
      window.handleProtocol('setThreeminInfo', _obj);
      window.handleProtocol('callThreeminInfo', 'handleForceEnableGame');
    }
  }, 300);
}

$(document).ready(function () {
  window.globalHandleNotifyCurrentPage(1);
  window.handleProtocol('totalpage', 1);

  setTimeout(function () { parent.document.querySelector('#wrap .t_activity .fel_topad').style.display = 'block'; }, 2000);

  setTimeout(function () {
    $(".vs-position-change .md-switch-label").after($(".vs-position-change .md-switch-container"));
    $(".vs-position-change").show();
  }, 100);

  var $main = new Vue({
    el: '#main',

    created: function () {
      $$main = this;

      _init_content();

      this.$nextTick(function () {
        // top.student.$$main.gamed = false;
        // top.others.$$main.gamed = false;
      });
    },

    mounted: function () {
      this.$nextTick(function () {

        this.bgm = window.parent._bgm;

        var _path = document.location.pathname.split('lottery.html')[0];
        play($(window.parent.document).find('#vs-bgm')[0], _path + '/mp3/bingo_bgm.mp3');
      });

      for (var i = 0; i < $('.ball').length; i++) {
        $($('.ball')[i]).css('left', _x[i]);
        $($('.ball')[i]).css('top', _y[i]);
      }
    },

    computed: {

    },

    data: {
      level: 0,
      grid: 0,
      row: 0,
      bgm: true,
      word: null,
    },

    methods: {
      fnToPad: function (ref) {
        $('#to_pad').addClass('animate__animated animate__bounceOutDown');
        // top.student.location.href = 'game.html#' + this.level + '_' + this.grid + '_' + this.row;
        // top.others.location.href = 'game.html#' + this.level + '_' + this.grid + '_' + this.row;
        setTimeout(function () {
          // $('#to_pad').removeClass('animate__animated');
          $('#btnProgress').show().addClass('animate__animated animate__bounceInUp');
        }, 300);
      },
      fnGacha: function (e) {
        if (!clickable) return false;
        if (_playing) return false;
        _playing = true;

        // window.handleProtocol('callThreeminInfo', 'callReady');

        setBall();

        $('#gacha').hide();
        play($('#vs-effect')[0], './mp3/click.mp3');
        var img_arr = ['ball_pink', 'ball_green', 'ball_yellow', 'ball_white', 'ball_blue'];
        _active_color = img_arr[parseInt(Math.random() * 5)];

        $('#ball').hide();
        $('#ball').css({ 'left': '840px', 'top': '560px', 'background-image': 'url(./assets/img/' + _active_color + '_m.png)' });
        $('#ball').html('<div id="bingo-context">' + $$main.word.equation + '</div>');
        $('.ball').show();
        // $('#gacha').attr('disabled', true);
        drawBalls();
      },
      fnCompleted: function (e) {
        // console.log(e);
      },
      toHome: function (e) {
        window.parent._sharedObject = null;
        window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
        window.handleProtocol('callRetry');
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

  $('#canvas').click(function () {
    if (_enabled) $$main.fnGacha();
  })

  $('.md-tabs-navigation-scroll-container').prepend("<span class='list-title'>TEST Mode</span>");

  $('.md-theme-default.md-tabs > .md-tabs-navigation .md-tab-indicator').prepend('<i aria-hidden="true" class="md-icon md-size-3x md-theme-default material-icons arrow_up_indicator">arrow_drop_up</i>');
  $('.md-theme-default.md-tabs > .md-tabs-navigation .md-tab-indicator').css('left', '180px');

  setTimeout(function () {
    _obj.wordsData = _defaultArr;
    _obj.s_target = 'game.html';
    _obj._bingoUser = [];

    setTimeout(function () {
      window.handleProtocol('setThreeminInfo', _obj);
    }, 200);

  }, 300);

  $(parent.document).find('body').find('.btn_ok').click(function () {
    clickable = false;
    window.handleProtocol('callThreeminInfo', 'sIndexTo3Min');
    if ($(parent.document).find('body').find('.pop_box .text').text() == 'Retry?') {
      $('#gacha').hide();
      setTimeout(function () {
        document.location.reload();
        // location.href = 'lottery.html#' + $$main.level + '_' + $$main.grid + '_' + $$main.row;
      }, 300);
    }
  });

  $(parent.document).find('body').find('.fel_topad').bind('touchstart click', function () {
    clickable = true;
    window.r_length = 0;
    setTimeout(function () {
      var _studentsList = window.parent._studentsList;
      _obj._bingoUser = [];
      _studentsList.forEach(function (student) {
        student.isBingo = false;
        _obj._bingoUser.push(student);
      });
      window.parent._bingoUser = _obj._bingoUser;
      _obj.init = true;
      _obj.s_length = _studentsList.length;
      setTimeout(function () { window.handleProtocol('setThreeminInfo', _obj) }, 100);
      $('#machine_line').fadeIn().delay(10).fadeOut().delay(10).fadeIn().delay(10).fadeOut().delay(10).fadeIn().delay(10).fadeOut();
      setTimeout(function () { parent.document.querySelector('#wrap .t_activity .fel_topad').style.display = 'none'; }, 1000);
      setTimeout(function () { _enabled = true; }, 2000);
    }, 500);
  });

  // $(parent.document).find('body').find('#wrap').hide();
});
