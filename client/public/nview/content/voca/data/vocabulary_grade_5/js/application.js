Vue.use(VueMaterial)

Vue.material.registerTheme({
  default: {
    primary: 'blue',
    accent: 'red'
  },
  green: {
    primary: 'green',
    accent: 'pink'
  },
  orange: {
    primary: 'orange',
    accent: 'green'
  },
});

var $$main;

var $$code;

var $$subject = "grade_5";

var _existDB = false;
var _storageable = false;
var __store = store;
var href = document.location.href;
var _current = href.split('/')[href.split('/').length - 1];

if(_current == '' || _current == 'index.html' || _current == 'start.html') {
  __store.clearAll();
}

if(__store.get('visang_subject') !== undefined) {
  $$subject = store.get('visang_subject');
  __store = store.namespace('visang_' + store.get('visang_subject'));
} else {
  $$subject = 'grade_5';
  __store = store.namespace('visang_' + "grade_5");
}

var x2js = new X2JS();
var jsonObj;

var xmlData;
var wordData;
var value;

var lesson_title = '';

var arrLessons = [];
var arrWords = [];

var _audio;

if(__store.storage.name !== 'cookieStorage') {
  _storageable = true;
  if(__store.get('xml') !== undefined) {
    value = __store.get('xml');
  } else {
    getXML();
  }
} else {
  _storageable = false;
  getValue();
}

function isInArray(value, array) {
  return array.indexOf(value) > -1;
}

function onlyUnique(value, index, self) { 
  return self.indexOf(value) === index;
}

function sleep(milliseconds) {
  var start, i;
  start = new Date().getTime();
  for (i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds) {
      break;
    }
  }
}

$.fn.textfill1 = function(options) {
  var fontSize = options.maxFontPixels;
  var ourText = $('span:visible', this);
  var maxHeight = $(this).height();
  var maxWidth = $(this).width();
  var textHeight;
  var textWidth;
  do {
    ourText.css('font-size', fontSize);
    textHeight = ourText.height();
    textWidth = ourText.width();
    fontSize = fontSize - 5;
  } while ((textHeight > maxHeight || textWidth > maxWidth) && fontSize > 20);
  return this;
}

function getValue() {
  var _url = 'data/vocabulary_' + $$subject + '.xml';
  $.ajax({
    url: _url,
    type: 'GET',
    dataType: 'xml',
    success : function(xml) {
      jsonObj = x2js.xml2json(xml);
      value = jsonObj;
    }, fail: function() {
      console.log('get value failed')
    }
  });
}

function getXML() {
  var _url = 'data/vocabulary_' + $$subject + '.xml';
  $.ajax({
    url: _url,
    type: 'GET',
    dataType: 'xml',
    success : function(xml) {
      jsonObj = x2js.xml2json(xml);
      
      value= jsonObj;
      if(_storageable) {
        __store.set('xml', jsonObj);
      }

      xmlData = $(xml).find("lesson");
      var listLength = xmlData.length;
      
      if(listLength) {
        var contentStr = "";

        $(xmlData).each(function() {
          var _tmp =  $(this).attr('elem').split('_');
          arrLessons.push( { 
            index:  getIndex( $(this).attr('index')  ), 
            name:   getName(  $(this).attr('name')   ) ,
            icon:   getIcon(  $(this).attr('icon')   ),
            topics: Number(   $(this).attr('topics') ),
            elem:   _tmp,
            length: $(this).find('word').length,
          });
        })
      }

      if($$main !== undefined) {
        $$main.lessons = arrLessons;
      }

    }, fail: function() {
      console.log('ajax failed');
    }
    
  });
}

function init() {
  if(_storageable) {
    var xmlData = $(x2js.json2xml(value)).find('lesson');
    var listLength = xmlData.length;
    
    if(listLength) {
      var contentStr = "";
      if(arrLessons.length > 0) return;
      var _tmp =  $(this).attr('elem').split('_');
          arrLessons.push( { 
            index:  getIndex( $(this).attr('index')  ), 
            name:   getName(  $(this).attr('name')   ) ,
            icon:   getIcon(  $(this).attr('icon')   ),
            topics: Number(   $(this).attr('topics') ),
            elem:   _tmp,
            length: $(this).find('word').length,
          });
    }
    $$main.lessons = arrLessons;
  } else {
    getXML();
  }
}

function numToNDigitStr(num, n) {
  if (num >= Math.pow(10, n-1)) { return num; }
  return '0' + numToNDigitStr(num, n-1);
}

function getIndex(arg) {
  return numToNDigitStr(arg, 2);
}

function getIcon(arg) {
  var _html = '';

  if (arg == '1') { _html = '<img src="./assets/img/icon_1.png"/>'; }
  if (arg == '2') { _html = '<img src="./assets/img/icon_2.png"/>'; }
  if (arg == '3') { _html = '<img src="./assets/img/icon_3.png"/>'; }
  if (arg == '4') { _html = '<img class="mt_20" src="./assets/img/icon_4.png"/>'; }

  if (arg == '1_3') { _html = '<img class="w_25 mr_15" src="./assets/img/icon_1.png"/><img class="w_25 ml_15" src="./assets/img/icon_3.png"/>'; }

  return _html;
}

function getName(arg) {

  var regRes = arg.match(new RegExp("Lesson [0-9]+\\."));

  if(regRes) {
    return '<span class="sequence">' +  arg.split('.')[0] + ' ' + arg.split(regRes)[1].trim() + '</span>';
  } else {
    return '<span class="sequence">' + arg + '</span>';
  }
}


$(document).ready(function() {
  var _w_width = $(window).width();
  var _w_height = $(window).height();
  var _ratio = _w_height / 1280;
  sleep(10);
  $('meta[name="viewport"]').attr('content', 'target-densitydpi=device-dpi, width=device-width, initial-scale=' + _ratio + ', user-scalable=no');

  setTimeout(function () {
    $(this.parent.document).find('#common_navi_left').hide();
    $(this.parent.document).find('#common_navi_right').hide();
    $(this.parent.document).find('.activityContent .pagination').hide();
  }, 10);
  
  if($$subject === 0) {
    $('body').removeClass('high_school')
  }

  $('#main.hide').hide();
  if($('#loader')) $('#loader').remove();
  $('#main.hide').show();
});
