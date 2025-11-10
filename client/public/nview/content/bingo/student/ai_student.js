console.log('Student AI Integration Loading...');

function initStudentAI() {
    console.log('Student AI Ready');
    
    // AI 문제 수신 리스너 추가
    if (window.psoc_o && window.psoc_o.onMessage) {
        const original = window.psoc_o.onMessage;
        window.psoc_o.onMessage = function(msg) {
            if (msg.type === 'AI_QUESTION') {
                console.log('AI Question Received:', msg.data);
                showAIQuestion(msg.data);
            }
            if (original) original.call(this, msg);
        };
    }
}

function showAIQuestion(question) {
    // AI 문제 표시 (간단한 alert로 테스트)
    alert('AI 문제: ' + question.question + '\n정답: ' + question.answer);
}

document.addEventListener('DOMContentLoaded', initStudentAI);
