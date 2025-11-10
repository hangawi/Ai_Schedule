var _obj = {};

var _index;

var _stored_list;
var _my_word_list;
var _my_list;

var _selected;

var _direction_of_move;

var _current_mode = 1;

var _track_list = [];

var _word = 0;
var _is_paused = false;

var _hash;

var _completed = false;

window.started = false;

function play(audio, url) {
  return new Promise(function (resolve, reject) { // return a promise
    // var audio = new Audio();                     // create audio wo/ src
    // var audio = $('#audio')[0];                     // create audio wo/ src
    audio.preload = "auto";                      // intend to play through
    audio.autoplay = true;                       // autoplay when loaded
    audio.onerror = reject;                      // on error, reject
    audio.onended = resolve;                     // when done, resolve

    audio.src = url
  });
}

function handleForceEnableGame() {
  setTimeout(function () {
    if (window.started == false) $$main.gamed = true;
    if (window.parent._sharedObject.answer == undefined) {
      window.handleProtocol('callThreeminInfo', 'handleForceInfo');
    }
  }, 500);
}

function handleEnableGame() {
  setTimeout(function () { $$main.gamed = true; }, 500);
}

// function callReady() {
//   window.handleProtocol('callThreeminInfo', 'handleReady');
// }

$(document).ready(function () {

  _audio = $('#audio')[0];

  var store = new Vuex.Store({
    state: {
      turn: 0,
      bingo: 0,
      winner: null
    },
    getters: {
      getBingo: function (state) {
        return state.bingo;
      }
    },
    mutations: {
      changeTurn: function (state) {
        return state.turn++;
      },
      resetTurn: function (state) {
        return state.turn = 0;
      },
      checkBingo: function (state, payload) {
        return state.bingo = payload;
      },
      gameWinner: function (state, payload) {
        return state.winner = payload;
      }
    }
  });

  var $main = new Vue({
    el: '#main',
    store,
    created: function () {
      $$main = this;

      if (window.parent._sharedObject != undefined) {
        var level = window.parent._sharedObject.level;
        var grid = window.parent._sharedObject.grid;
        var row = window.parent._sharedObject.row;

        this.maxBingo = Number(row);
        this.grid = Number(grid);

        this.shackBingo();

        window.handleProtocol('callThreeminInfo', 'handleReady');
        setTimeout(function () { play($('#vs-effect')[0], './mp3/effect/bingo_numbercard.mp3'); }, 100);
      } else {
        setTimeout(function () { document.location.reload(); }, 500);
      }
    },

    mounted: function () {
      this.$nextTick(function () {

      });
    },

    props: {
      user: String
    },

    computed: {
      maxPaging: function () {
        return $$main.words.length;
      },
      // 
      getBingo: function () {

        return this.$store.getters.getBingo;
      }
    },

    data: {
      gamed: false,
      user: 'user_1',
      bingoBoard: [],
      bingo: [],
      bingoOrigin: [],
      verticalBingo: 0,
      horizontalBingo: 0,
      diagonalBingo: 0,
      totalBingo: 0,
      maxBingo: 3,
      grid: 5,
      complete: false,
    },

    methods: {
      fetchData: function () {
        $$main.lessons = arrLessons;
      },

      linkToHome: function () {
        location.href = 'index.html';
      },

      open: function (ref) {

      },
      close: function (ref) {

      },

      // 다이얼로그
      openDialog: function (ref) {
        this.$refs[ref].open();
      },
      closeDialog: function (ref) {
        this.$refs[ref].close();
      },
      onOpen: function () {

      },
      onClose: function (type) {

      },

      // 
      shackBingo: function () {
        let total = this.grid * this.grid;

        let temp = [];

        var _data = window.parent._sharedObject.wordsData;
        var arr = [];

        _data.forEach(function (val) {
          arr.push(Number(val.answer));
        });

        arr.sort(function () { return 0.5 - Math.random() });
        this.bingoBoard = arr;

        for (let j = 0, i = 0; i < total; i++) {
          temp[i % this.grid] = arr[i];

          if ((i + 1) % this.grid === 0) {
            this.bingo[j] = temp;
            j++;
            temp = [];
          }
        }

        for (let j = 0, i = 0; i < total; i++) {
          temp[i % this.grid] = arr[i];

          if ((i + 1) % this.grid === 0) {
            this.bingoOrigin[j] = temp;
            j++;
            temp = [];
          }
        }

        var _max = this.bingoBoard.reduce(function (a, b) { return Math.max(a, b) })

        var _size = 150;
        var _margin = 13;
        var _top = 60;
        var _gap = 10;
        if (this.grid == 3) {
          _size = 150;
          _margin = 13;
          _top = 135;
          _left = 63;
          _gap = 10;
          _font_size = 60;
        } else if (this.grid == 4) {
          _size = 120;
          _margin = 6;
          _top = 136;
          _left = 63;
          _gap = 10;
          _font_size = 60;
          if (_max >= 1000) _font_size = 45;
        } else if (this.grid == 5) {
          _size = 100;
          _margin = 3;
          _top = 135;
          _left = 60;
          _gap = 10;
          _font_size = 60;
          if (_max >= 100) _font_size = 50;
          if (_max >= 1000) _font_size = 40;
        }

        $('.bingo').css('font-size', _font_size + 'px');
        $('.bingo').css('flex', '0 0 ' + _size + 'px');
        $('.bingo').css('height', (_size - _gap) + 'px');
        $('.bingo').css('margin', _margin + 'px');
        $('.bingo').css('margin-bottom', (_margin + _gap) + 'px');
        $('#bingo').css('top', _top + 'px');
        $('#bingo').css('left', _left + 'px');
      },
      checkBingo: function (number) {
        if (_completed) return false;
        var selectedBingo = this.$refs['bingo_' + number];

        for (var l = 0; l < selectedBingo.length; l++) {
          if (Number($($(selectedBingo)[l]).attr('seq')) == _selected) {
            $($(selectedBingo)[l]).addClass('active_bingo');
          }
        }

        this.bingo[parseInt(Number(_selected) / this.grid)][Number(_selected) % this.grid] = true;

        this.checkHorizontal();
        this.checkVertical();
        this.checkDiagonal();

        var _random = parseInt(Math.random() * 5);

        $('.bingo.bingoCorrect').each(function (index, item) {

          var _class = item.classList;

          if (_class.value.indexOf('old') == -1) {
            $(item).css('background', 'transparent url(./assets/img/btn_bingo-' + _random + '.png) no-repeat 0 0');
            $(item).addClass('old');
            play($('#vs-effect')[0], './mp3/effect/bingo_row.mp3');
          }
        })

        $('.bingo.bingoCorrect').css('background-size', 'cover');
        $('.bingo.bingoCorrect').css('text-indent', '-9999em');

        setTimeout(function () {
          if ($$main.totalBingo >= $$main.maxBingo) {
            $('.bingo').css('cursor', 'default');

            $('#lottie').css('z-index', '9999');
            $('#lottie img').attr('src', './assets/img/aniBingo.gif?' + Math.random(10));

            var bingoUser = window.parent._studentId;
            _obj = window.parent._sharedObject;
            _obj._bingoUser.forEach(function (user) {
              if (user.id == bingoUser.id) {
                user.isBingo = true;
              }
            });

            window.handleProtocol('setThreeminInfo', _obj);
            setTimeout(function () { window.handleProtocol('callThreeminInfo', 'handleProgress'); });
            if (_completed == false) {
              handleProtocol('completed');
              _completed = true;
            }

            $$main.gamed = false;
            $$main.complete = true;
          }
        }, 200);

      },
      clickBingo: function (number) {
        if (this.complete) {
          return;
        }

        play($('#vs-effect')[0], './mp3/effect/bingo_click.mp3');

        this.$store.commit("checkBingo", number);
        this.checkBingo(number);
      },

      fnClick: function (seq, number) {
        _selected = seq;
        // this.clickBingo(number);
        if (this.gamed == false) {
          return;
        }
        if (Number(window.parent._sharedObject.answer) != number) {
          this.gamed = true;
          play($('#vs-effect')[0], './mp3/wrong.mp3');
          return false;
        } else {
          this.clickBingo(number);
          this.gamed = false;
          window.started = true;
        }
      },

      passedBingo: function (val) {
        this.checkBingo(val);
      },

      checkVertical: function () {
        this.verticalBingo = 0;

        for (let i = 0; i < this.grid; i++) {
          for (let j = 0; j < this.grid; j++) {
            if (this.bingo[j][i] === true) {
              if (j === (this.grid - 1)) {
                for (k = 0; k < this.grid; k++) {
                  if (this.bingo[k][i] == true) {
                    var _target = (k * this.grid) + i;
                    $('div.bingo[seq="' + _target + '"]').addClass('bingoCorrect');
                  }
                }
                this.verticalBingo++;
              }
            } else {
              break;
            }
          }
        }
      },
      checkHorizontal: function () {
        this.horizontalBingo = 0;

        for (let i = 0; i < this.grid; i++) {
          if (this.bingo[i].every(function (x) { return x === true })) {
            for (j = 0; j < this.grid; j++) {
              if (this.bingo[i][j] == true) {
                var _target = (i * this.grid) + j;
                $('div.bingo[seq="' + _target + '"]').addClass('bingoCorrect');
              }
            }
            this.horizontalBingo++;
          }
        }
      },
      checkDiagonal: function () {
        let check = true;
        this.diagonalBingo = 0;

        for (let i = 0; i < this.grid; i++) {
          if (this.bingo[i][i] !== true) {
            check = false;
          }
        }
        if (check === true) {
          for (let i = 0; i < this.grid; i++) {
            if (this.bingo[i][i] == true) {
              if (this.bingo[i][i] == true) {
                var _target = (i * this.grid) + i;
                $('div.bingo[seq="' + _target + '"]').addClass('bingoCorrect');
              }
            }
          }
          this.diagonalBingo++;
        }

        check = true;
        for (let i = 0; i < this.grid; i++) {
          if (this.bingo[i][(this.grid - 1) - i] !== true) {
            check = false;
          }
        }
        if (check === true) {
          for (let i = 0; i < this.grid; i++) {
            if (this.bingo[i][(this.grid - 1) - i] === true) {
              var _target = (i * this.grid) + ((this.grid - 1) - i);
              $('div.bingo[seq="' + _target + '"]').addClass('bingoCorrect');
            }
          }
          this.diagonalBingo++;
        }
      },

      resetBoard: function () {
        this.bingoBoard = [];
      },
      resetGame: async function () {
        await this.resetBoard();
        await this.shackBingo();
      }

    },

    watch: {
      paging: function (val) {
      },

      currentWord: function (val) {
        $$main.currentWord = val;

        if ($$main.words[$$main.currentWord].in_my_word) {
          $('.vs-add_to_my_word i').text('star')
        } else {
          $('.vs-add_to_my_word i').text('star_border')
        }

        var tmp = -(val * $('#app .md-boards').width());
        $('.md-boards-wrapper').attr('style', 'transform: translate3d(' + tmp + 'px, 0px, 0px)');
        $$main.fnTestHandle($('button.md-tab-header.md-active').index());
        $$main.paging = ($$main.currentWord + 1);
      },

      verticalBingo() {
        this.totalBingo = this.totalBingo + 1;
      },
      horizontalBingo() {
        this.totalBingo = this.totalBingo + 1;
      },
      diagonalBingo() {
        this.totalBingo = this.totalBingo + 1;
      },
      getBingo(val) {
        this.passedBingo(val);
      },
    }
  });

  $('.md-tabs-navigation-scroll-container').prepend("<span class='list-title'>TEST Mode</span>");

  $('.md-theme-default.md-tabs > .md-tabs-navigation .md-tab-indicator').prepend('<i aria-hidden="true" class="md-icon md-size-3x md-theme-default material-icons arrow_up_indicator">arrow_drop_up</i>');
  $('.md-theme-default.md-tabs > .md-tabs-navigation .md-tab-indicator').css('left', '180px');
});
