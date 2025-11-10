// Math Alive AI Integration - Full Version
console.log('🤖 AI Panel Loading...');

const AI_CONFIG = {
    API_BASE: 'http://localhost:5000/api/nview',
    isReady: false,
    currentQuestions: new Map()
};

// AI 패널 생성
function createAIPanel() {
    const panel = document.createElement('div');
    panel.id = 'ai-control-panel';
    panel.innerHTML = `
        <style>
            #ai-control-panel {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 15px;
                padding: 25px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 99999;
                width: 350px;
                font-family: 'Malgun Gothic', sans-serif;
            }
            #ai-control-panel h3 {
                margin: 0 0 15px 0;
                color: #667eea;
                font-size: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            #ai-control-panel .status {
                font-size: 12px;
                color: #999;
                margin-bottom: 20px;
                padding: 8px;
                background: #f8f9fa;
                border-radius: 5px;
                text-align: center;
            }
            #ai-control-panel .status.ready {
                background: #d4edda;
                color: #155724;
            }
            #ai-control-panel .control-group {
                margin-bottom: 15px;
            }
            #ai-control-panel label {
                display: block;
                margin-bottom: 5px;
                font-size: 14px;
                font-weight: bold;
                color: #555;
            }
            #ai-control-panel select {
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 14px;
                background: white;
                cursor: pointer;
            }
            #ai-control-panel select:focus {
                outline: none;
                border-color: #667eea;
            }
            #ai-control-panel button {
                width: 100%;
                padding: 14px;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                margin-bottom: 10px;
                transition: all 0.3s;
            }
            #ai-control-panel button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            #ai-control-panel .btn-generate {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            #ai-control-panel .btn-generate:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
            }
            #ai-control-panel .btn-send {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
            }
            #ai-control-panel .btn-send:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(245, 87, 108, 0.3);
            }
            #ai-control-panel .preview {
                background: #f8f9fa;
                border-radius: 10px;
                padding: 15px;
                margin-top: 15px;
                display: none;
            }
            #ai-control-panel .preview.show {
                display: block;
            }
            #ai-control-panel .question-text {
                background: white;
                padding: 15px;
                border-radius: 8px;
                font-size: 20px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 10px;
                color: #333;
            }
            #ai-control-panel .answer-text {
                text-align: center;
                color: #666;
                font-size: 14px;
            }
            #ai-control-panel .minimize-btn {
                position: absolute;
                top: 15px;
                right: 15px;
                background: #f0f0f0;
                border: none;
                border-radius: 5px;
                width: 30px;
                height: 30px;
                cursor: pointer;
                font-size: 18px;
                font-weight: bold;
            }
        </style>

        <button class="minimize-btn" onclick="toggleAIPanel()">−</button>

        <h3>
            <span>🤖</span>
            <span>AI 문제 출제</span>
        </h3>

        <div class="status" id="ai-status">백엔드 연결 확인 중...</div>

        <div class="control-group">
            <label>난이도</label>
            <select id="ai-difficulty">
                <option value="easy">쉬움 (초등 저학년)</option>
                <option value="medium" selected>보통 (초등 중학년)</option>
                <option value="hard">어려움 (초등 고학년)</option>
            </select>
        </div>

        <div class="control-group">
            <label>문제 유형</label>
            <select id="ai-type">
                <option value="addition" selected>덧셈 (+)</option>
                <option value="subtraction">뺄셈 (-)</option>
                <option value="multiplication">곱셈 (×)</option>
                <option value="division">나눗셈 (÷)</option>
            </select>
        </div>

        <div class="control-group">
            <label>대상 학생</label>
            <select id="ai-target">
                <option value="all">전체 학생</option>
            </select>
        </div>

        <button class="btn-generate" id="ai-generate-btn">
            ✨ AI 문제 생성
        </button>

        <div class="preview" id="ai-preview">
            <div style="font-weight: bold; margin-bottom: 10px; color: #667eea;">📝 생성된 문제</div>
            <div class="question-text" id="ai-question"></div>
            <div class="answer-text">
                정답: <strong id="ai-answer"></strong>
            </div>
            <button class="btn-send" id="ai-send-btn">
                📤 학생에게 전송
            </button>
        </div>
    `;

    document.body.appendChild(panel);
    console.log('✅ AI Panel Created');
}

// 백엔드 연결 확인
async function checkBackend() {
    try {
        const response = await fetch(AI_CONFIG.API_BASE + '/health');
        const data = await response.json();
        console.log('✅ Backend Connected:', data);
        AI_CONFIG.isReady = true;
        updateStatus('✅ 백엔드 연결됨', true);
        return true;
    } catch (error) {
        console.warn('⚠️ Backend Not Connected:', error.message);
        AI_CONFIG.isReady = false;
        updateStatus('⚠️ 백엔드 미연결 (npm start 실행 필요)', false);
        return false;
    }
}

// 상태 업데이트
function updateStatus(message, isReady) {
    const statusEl = document.getElementById('ai-status');
    if (statusEl) {
        statusEl.textContent = message;
        if (isReady) {
            statusEl.classList.add('ready');
        } else {
            statusEl.classList.remove('ready');
        }
    }
}

// 학생 목록 로드
function loadStudents() {
    console.log('Loading students...');

    // tsoc_o가 준비될 때까지 대기
    const waitForTsoc = setInterval(() => {
        if (window.tsoc_o && window.tsoc_o.getStudents) {
            clearInterval(waitForTsoc);

            window.tsoc_o.getStudents((students, success) => {
                console.log('Students loaded:', students);
                const select = document.getElementById('ai-target');

                if (students && students.length > 0) {
                    students.forEach(student => {
                        const option = document.createElement('option');
                        option.value = student.id;
                        option.textContent = student.name || `학생 ${student.id}`;
                        select.appendChild(option);
                    });
                }
            });
        }
    }, 500);

    // 10초 후 타임아웃
    setTimeout(() => clearInterval(waitForTsoc), 10000);
}

// AI 문제 생성
async function generateQuestion() {
    if (!AI_CONFIG.isReady) {
        alert('⚠️ AI 백엔드가 연결되지 않았습니다.\n\n터미널에서 다음 명령을 실행하세요:\ncd backend\nnpm start');
        return;
    }

    const difficulty = document.getElementById('ai-difficulty').value;
    const type = document.getElementById('ai-type').value;
    const target = document.getElementById('ai-target').value;
    const btn = document.getElementById('ai-generate-btn');

    btn.disabled = true;
    btn.textContent = '🔄 AI 생성 중...';

    try {
        const response = await fetch(AI_CONFIG.API_BASE + '/api/generate-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                difficulty,
                type,
                game_type: 'bingo',
                studentId: target === 'all' ? 'teacher' : target
            })
        });

        const question = await response.json();
        AI_CONFIG.currentQuestions.set(target, question);

        // UI 업데이트
        document.getElementById('ai-question').textContent = question.question;
        document.getElementById('ai-answer').textContent = question.answer;
        document.getElementById('ai-preview').classList.add('show');

        console.log('✅ Question Generated:', question);

    } catch (error) {
        console.error('❌ Generation Error:', error);
        alert('문제 생성 실패: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '✨ AI 문제 생성';
    }
}

// 학생에게 전송
function sendQuestion() {
    const target = document.getElementById('ai-target').value;
    const question = AI_CONFIG.currentQuestions.get(target);

    if (!question) {
        alert('먼저 문제를 생성해주세요!');
        return;
    }

    if (!window.tsoc_o) {
        alert('통신 시스템이 준비되지 않았습니다!');
        return;
    }

    const message = {
        type: 'AI_QUESTION',
        data: question
    };

    try {
        if (target === 'all') {
            window.tsoc_o.sendAll(message);
            console.log('📤 Sent to ALL students:', question);
            alert('✅ 전체 학생에게 문제가 전송되었습니다!');
        } else {
            window.tsoc_o.sendPADToID(target, message);
            console.log('📤 Sent to student', target, ':', question);
            alert(`✅ 학생에게 문제가 전송되었습니다!`);
        }
    } catch (error) {
        console.error('❌ Send Error:', error);
        alert('전송 실패: ' + error.message);
    }
}

// 패널 최소화/최대화
window.toggleAIPanel = function() {
    const panel = document.getElementById('ai-control-panel');
    const btn = panel.querySelector('.minimize-btn');

    if (panel.style.width === '100px') {
        panel.style.width = '350px';
        panel.style.height = 'auto';
        Array.from(panel.children).forEach((child, i) => {
            if (i > 0) child.style.display = '';
        });
        btn.textContent = '−';
    } else {
        panel.style.width = '100px';
        panel.style.height = '60px';
        Array.from(panel.children).forEach((child, i) => {
            if (i > 0) child.style.display = 'none';
        });
        btn.textContent = '+';
    }
};

// 초기화
function initAI() {
    console.log('🚀 Initializing AI Panel...');

    // 패널 생성
    createAIPanel();

    // 백엔드 연결 확인
    checkBackend();
    setInterval(checkBackend, 10000); // 10초마다 재확인

    // 학생 목록 로드
    setTimeout(loadStudents, 1000);

    // 이벤트 리스너
    setTimeout(() => {
        const generateBtn = document.getElementById('ai-generate-btn');
        const sendBtn = document.getElementById('ai-send-btn');

        if (generateBtn) generateBtn.addEventListener('click', generateQuestion);
        if (sendBtn) sendBtn.addEventListener('click', sendQuestion);
    }, 1000);
}

// 페이지 로드 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAI);
} else {
    initAI();
}

console.log('✅ AI Integration Script Loaded');
