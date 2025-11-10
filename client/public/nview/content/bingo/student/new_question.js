
if (typeof app_o === 'undefined') {
  var app_o = {};
}

app_o.receive = function(message) {
  if (message.type === 'new_question') {
    const questionContainer = document.getElementById('question-container');
    if (questionContainer) {
      questionContainer.innerHTML = `<h1>${message.data.question}</h1>`;
    }
  }
};
