var _index;

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

function fnToQuestion() {
  if (window.parent._sharedObject.user_questioner.id == window.parent._studentId.id) {
    document.location.reload();
  } else {
    document.location.href = 'attention.html';
  }
}

function fnToBuzzer() {
  if (window.parent._sharedObject.user_opened.id != window.parent._studentId.id) {
    document.location.href = 's_hit_buzzer.html';
  }
}

var _question_list = {
  'place': [
    ['Is it bigger than this classroom? '],
    ['Do a lot of peaple live there?'],
    ['Can you walk there? '],
    ['Is it well known?'],
    ['What can we do there?'],
    ['What can we see there?'],
  ],
  'animal': [
    ['Does it have hair? (feather, legs, break etc)'],
    ['Is it small?'],
    ['Is it bigger than a dog? '],
    ['What does it eat? '],
    ['How many legs does it have? '],
    ['Does it live under the sea? '],
    ['Is it a mammal? (reptile etc)'],
    ['Where can I see it?'],
  ],
  'things': [
    ['Can it roll? (stand)'],
    ['Is it natural? (man made)'],
    ['Is it bigger than eraser?'],
    ['Is it longer than pencil?'],
    ['Is it in the classroom?'],
    ['Is it soft or hard?'],
    ['Is it made of wood? (metal, plastic, glass etc)'],
    ['Do you use it to study?'],
    ['Can you eat it?'],
  ],
  'shapes': [
    ['Is it round?'],
    ['Does it have flat surfaces?'],
    ['Can it roll? '],
    ['How does it look like?'],
    ['Is it look like a clock? (a can, a gift box)'],
    ['How many edge (vertices, faces) does it have?'],
    ['Are the sides the same length?'],
    ['How many side (vertices) does it have?'],
    ['Can I see that shape in this classroom?'],
    ['Does it have an acute (obtuse) angle?'],
    ['Does it have a pair (two pairs) of parallel lines?'],
    ['Are the two facing side the same length?'],
  ],
  'numbers': [
    ['Is this number greater than _______?'],
    ['Is this number less than _______?'],
    ['Is it 2-digit number? (1-digit)'],
    ['Is the number between 10 and 20?'],
    ['Is it odd or even?'],
  ],
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

      var _get_list = [];
      var _list = getRandom(_question_list[window.parent._sharedObject.list_target], 3);
      $(_list).each(function () {
        if ($(this).length > 1) {
          _get_list.push(getRandom($(this), 1)[0][0]);
        } else {
          _get_list.push($(this)[0]);
        }
      })
      
      this.question_list = _get_list;

      $$main.question_list = _get_list;
    },

    mounted: function () {

    },

    computed: {

    },

    data: {
      bgm: true,
      question_list: [],
    },

    methods: {
      toCheck: function (e) {
        location.href = "s_answer.html";
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
