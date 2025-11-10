console.log(localforage.supports(localforage.LOCALSTORAGE));
// var hasLocalStorageSupport;
// try {
//   hasLocalStorageSupport = 'localStorage' in $window && $window.localStorage !== null;
//   var testKey = 'pascalprecht.translate.storageTest';
//   console.log('support')
//   $window.localStorage.setItem(testKey, 'foo');
//   $window.localStorage.removeItem(testKey);
// } catch (e) {
//   hasLocalStorageSupport = false;
//   console.log('not support')
// }

var _existDB = false;

var __forage = localforage;

__forage.config({
    driver: [
      localforage.INDEXEDDB,
      localforage.WEBSQL,
      localforage.LOCALSTORAGE
    ],
    name: 'visaing_wordbook_test',
    storeName: 'word_book_store'
});

localforage.ready(function() {
  console.log('ready')
}).catch(function() {
  /* so that webpack sees the rejected promise as handled */
  console.log('webpack');
  console.log(localforage.supports(localforage.INDEXEDDB));
});

var x2js = new X2JS();

function sleep(milliseconds) {
  var start, i;
  start = new Date().getTime();
  for (i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds) {
      break;
    }
  }
}

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

var ___xml;

var $main = new Vue({
  el: '#main',

  created: function() {

    __forage.length().then(function(numberOfKeys){
      console.log(numberOfKeys)
      if(numberOfKeys === 0) {
        $.ajax({
          // url:'./data/word_01.xml',
          url:'./data/word.xml',
          type: 'GET',
          dataType: 'xml',
          success : function(xml) {

            var jsonObj = x2js.xml2json(xml);

            __forage.setItem('xml', jsonObj).then(function(value) {
              console.log('ajax success')
              console.log(value);
            }).catch(function(err) {
              console.log('ajax error')
              console.log(err);
            });

            var xmlData = $(xml).find("lesson");
            var listLength = xmlData.length;
            
            if(listLength) {
              var contentStr = "";

              $(xmlData).each(function() {
                arrLessons.push( { index: getIndex( $(this).attr('index') ), name: getName( $(this).attr('name') ) });
              })
            }

            $main.lessons = arrLessons;

          }, fail: function() {
            console.log('fail')
          }
        });
      } else {
        __forage.getItem('xml').then(function(value) {
          console.log('success');
          console.log(value);
          var xmlData = $(x2js.json2xml(value)).find('lesson');
          ___xml = xmlData;
          var listLength = xmlData.length;
          
          if(listLength) {
            var contentStr = "";

            $(xmlData).each(function() {
              arrLessons.push( { index: getIndex( $(this).attr('index') ), name: getName( $(this).attr('name') ) });
            })
          }

          $main.lessons = arrLessons;
        }).catch(function(err) {
          console.log('error');
          console.log(err);
        });
      }
    }).catch(function(err) {
      console.log(localforage.supports(localforage.LOCALSTORAGE));
      console.log(err);
    });

    this.$nextTick(function() {
      console.log('next tick')
    });
  },

  data: {
    lessons: arrLessons
  },

  methods: {
    selectTitle: function(index) {
      // __storage.setItem('lesson_index', index);
      __forage.getItem('lesson_index').then(function(value) {
        __forage.setItem('lesson_index', index);
      }).catch(function(err) {

      });
      sleep(1000);
      location.href = "./study.html";
    },

    toggleLeftSidenav: function() {
      this.$refs.leftSidenav.toggle();
    },
    closeLeftSidenav: function() {
      this.$refs.leftSidenav.close();
    },

    open: function(ref) {
      console.log('Opened: ' + ref);
    },
    close: function(ref) {
      console.log('Opened: ' + ref);
    },
  }
});

var arrLessons = [];

function numToNDigitStr(num, n) {
  if (num >= Math.pow(10, n-1)) { return num; }
  return '0' + numToNDigitStr(num, n-1);
}

function getIndex(arg) {
  return numToNDigitStr(arg, 2);
}

function getName(arg) {
  var regRes = arg.match(new RegExp("Lesson [0-9]+\\."));
  return arg.split(regRes)[1].trim();
}

$(document).ready(function() {

});
