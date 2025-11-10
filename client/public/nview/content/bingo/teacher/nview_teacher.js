const API_BASE = 'http://localhost:5000/api/nview';
const studentWindows = new Map();
const studentData = new Map();
const students = [
    { id: 'student1', name: '학생 1' },
    { id: 'student2', name: '학생 2' },
    { id: 'student3', name: '학생 3' }
];

function createStudentCard(student) {
    const card = document.createElement('div');
    card.className = 'student-card';
    card.innerHTML = `
        <div class="student-header">
            <div class="student-name">${student.name}</div>
            <div class="student-status waiting" id="status-${student.id}">대기중</div>
        </div>
        <button class="button open" onclick="openStudentWindow('${student.id}')">
            👨‍🎓 ${student.name} 창 열기
        </button>
        <button class="button generate" onclick="generateAndSendQuestion('${student.id}')" disabled id="generate-${student.id}">
            ✨ AI 문제 생성 & 전송
        </button>
        <button class="button personalized" onclick="generatePersonalizedQuestion('${student.id}')" disabled id="personalized-${student.id}" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; margin-top: 5px;">
            🎯 맞춤형 문제 생성 & 전송
        </button>
        <button class="button analyze" onclick="analyzeStudent('${student.id}')" disabled id="analyze-${student.id}" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; margin-top: 5px;">
            📊 학습 분석
        </button>
        <div class="question-preview" id="preview-${student.id}">
            <div class="question-text" id="question-${student.id}"></div>
            <div class="answer-text">정답: <span id="answer-${student.id}"></span></div>
        </div>
        <div class="result-box" id="result-${student.id}">
            <div style="font-size:32px;" id="result-icon-${student.id}"></div>
            <div style="font-weight:bold;margin:10px 0;" id="result-text-${student.id}"></div>
            <div id="result-detail-${student.id}"></div>
        </div>
        <div class="learning-stats" id="stats-${student.id}" style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 12px; display: none;">
            <div id="stats-content-${student.id}"></div>
        </div>
    `;
    return card;
}

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('studentGrid');
    students.forEach(student => {
        grid.appendChild(createStudentCard(student));
    });

    // 자동으로 오늘의 5문제 생성 (3초 후)
    setTimeout(() => {
        generateAllDailyQuestions();
    }, 3000);
});

// 모든 학생에게 오늘의 5문제 자동 생성
async function generateAllDailyQuestions() {
    console.log('📚 오늘의 5문제 자동 생성 시작...');

    const difficulty = document.getElementById('globalDifficulty').value;

    for (const student of students) {
        try {
            console.log(`${student.name}에게 5문제 생성 중...`);

            const response = await fetch(`${API_BASE}/generate-daily-questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: student.id,
                    difficulty: difficulty,
                    game_type: 'bingo'
                })
            });

            const data = await response.json();

            if (data.success) {
                console.log(`✅ ${student.name}: ${data.totalQuestions}개 문제 생성 완료`);

                // 학생 창이 열려있으면 문제 전송
                const w = studentWindows.get(student.id);
                if (w && !w.closed) {
                    w.postMessage({
                        type: 'daily_questions',
                        questions: data.questions
                    }, '*');
                    console.log(`📤 ${student.name}에게 문제 전송 완료`);
                }
            }
        } catch (error) {
            console.error(`${student.name} 문제 생성 오류:`, error);
        }
    }

    console.log('✅ 모든 학생에게 오늘의 문제 생성 완료!');
    alert('🎉 오늘의 5문제가 모든 학생에게 자동으로 생성되었습니다!');
}

window.openStudentWindow = async function(studentId) {
    if (studentWindows.has(studentId) && !studentWindows.get(studentId).closed) {
        studentWindows.get(studentId).focus();
        return;
    }
    const index = students.findIndex(s => s.id === studentId);
    const w = window.open(
        `../student/ai_demo_nview_student.html?studentId=${studentId}`,
        studentId,
        `width=600,height=500,left=${100+index*60},top=${100+index*60}`
    );
    if (w) {
        studentWindows.set(studentId, w);
        updateStatus(studentId, 'ready', '준비됨');
        document.getElementById(`generate-${studentId}`).disabled = false;
        document.getElementById(`personalized-${studentId}`).disabled = false;
        document.getElementById(`analyze-${studentId}`).disabled = false;

        // 학생 창 로드 후 오늘의 문제 전송
        setTimeout(async () => {
            try {
                const response = await fetch(`${API_BASE}/daily-questions/${studentId}`);
                const data = await response.json();

                if (data.questions && data.questions.length > 0) {
                    w.postMessage({
                        type: 'daily_questions',
                        questions: data.questions
                    }, '*');
                    console.log(`📤 ${studentId}에게 저장된 문제 전송 완료`);
                }
            } catch (error) {
                console.error(`문제 전송 오류:`, error);
            }
        }, 1000);
    }
};

window.generateAndSendQuestion = async function(studentId) {
    console.log('✨ 일반 문제 생성 시작:', studentId);

    // 1. Check if student window is open
    const w = studentWindows.get(studentId);
    console.log('학생 창 상태:', w ? '열림' : '닫힘', w && !w.closed ? '활성' : '비활성');

    if (!w || w.closed) {
        alert('먼저 학생 창을 열어주세요!');
        return;
    }

    const difficulty = document.getElementById('globalDifficulty').value;
    const type = document.getElementById('globalType').value;
    const previewEl = document.getElementById(`preview-${studentId}`);
    const generateBtn = document.getElementById(`generate-${studentId}`);

    generateBtn.disabled = true;
    previewEl.classList.remove('show');
    updateStatus(studentId, 'generating', '문제 생성 중...');

    try {
        console.log('📡 API 요청 시작:', { studentId, difficulty, type });

        // 2. Generate AI question
        const response = await fetch(`${API_BASE}/generate-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ difficulty, type, game_type: 'bingo', studentId })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ API 응답:', data);

        studentData.set(studentId, data);

        // 3. Display preview
        document.getElementById(`question-${studentId}`).textContent = data.question;
        document.getElementById(`answer-${studentId}`).textContent = data.answer;
        previewEl.classList.add('show');

        // 4. IMMEDIATELY send to student
        console.log('📤 학생에게 문제 전송:', { type: 'new_question', data });
        w.postMessage({ type: 'new_question', data }, '*');

        console.log('✅ 전송 완료!');
        updateStatus(studentId, 'answered', '문제 전송됨');

    } catch (error) {
        console.error('❌ 일반 문제 생성 오류:', error);
        alert(`문제 생성 실패: ${error.message}`);
        updateStatus(studentId, 'ready', '준비됨');
    } finally {
        generateBtn.disabled = false;
    }
};

function updateStatus(studentId, statusClass, text) {
    const el = document.getElementById(`status-${studentId}`);
    el.className = `student-status ${statusClass}`;
    el.textContent = text;
}

// 맞춤형 문제 생성 & 전송
window.generatePersonalizedQuestion = async function(studentId) {
    console.log('🎯 맞춤형 문제 생성 시작:', studentId);

    const w = studentWindows.get(studentId);
    console.log('학생 창 상태:', w ? '열림' : '닫힘', w && !w.closed ? '활성' : '비활성');

    if (!w || w.closed) {
        alert('먼저 학생 창을 열어주세요!');
        return;
    }

    const difficulty = document.getElementById('globalDifficulty').value;
    const previewEl = document.getElementById(`preview-${studentId}`);
    const personalizedBtn = document.getElementById(`personalized-${studentId}`);

    personalizedBtn.disabled = true;
    previewEl.classList.remove('show');
    updateStatus(studentId, 'generating', '맞춤형 문제 생성 중...');

    try {
        console.log('📡 API 요청 시작:', { studentId, difficulty });

        const response = await fetch(`${API_BASE}/generate-personalized-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, difficulty, game_type: 'bingo' })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ API 응답:', data);

        studentData.set(studentId, data);

        document.getElementById(`question-${studentId}`).textContent = data.question;
        document.getElementById(`answer-${studentId}`).textContent = data.answer;

        // 맞춤형 문제임을 표시
        if (data.targetWeakness) {
            const weaknessText = data.targetWeakness === 'addition' ? '덧셈' :
                                data.targetWeakness === 'subtraction' ? '뺄셈' :
                                data.targetWeakness === 'multiplication' ? '곱셈' : '나눗셈';
            document.getElementById(`question-${studentId}`).innerHTML =
                `<span style="color: #f5576c; font-weight: bold;">[${weaknessText} 약점 보완]</span><br>${data.question}`;
        }

        previewEl.classList.add('show');

        console.log('📤 학생에게 문제 전송:', { type: 'new_question', data });
        w.postMessage({ type: 'new_question', data }, '*');

        console.log('✅ 전송 완료!');
        updateStatus(studentId, 'answered', '맞춤형 문제 전송됨');

    } catch (error) {
        console.error('❌ 맞춤형 문제 생성 오류:', error);
        alert(`맞춤형 문제 생성 실패: ${error.message}`);
        updateStatus(studentId, 'ready', '준비됨');
    } finally {
        personalizedBtn.disabled = false;
    }
};

// 학습 분석
window.analyzeStudent = async function(studentId) {
    const analyzeBtn = document.getElementById(`analyze-${studentId}`);
    const statsEl = document.getElementById(`stats-${studentId}`);
    const statsContent = document.getElementById(`stats-content-${studentId}`);

    analyzeBtn.disabled = true;
    statsContent.innerHTML = '<div style="text-align:center;">분석 중...</div>';
    statsEl.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE}/analyze-student/${studentId}`);
        const analysis = await response.json();

        if (analysis.totalQuestions === 0) {
            statsContent.innerHTML = '<div style="text-align:center; color: #999;">아직 학습 데이터가 없습니다.</div>';
            return;
        }

        // 통계 표시
        let html = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #667eea;">📊 학습 통계</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                <div>총 문제: <strong>${analysis.totalQuestions}개</strong></div>
                <div>정답률: <strong style="color: ${analysis.accuracy >= 70 ? '#28a745' : analysis.accuracy >= 50 ? '#ffc107' : '#dc3545'}">${analysis.accuracy}%</strong></div>
                <div>정답: <strong style="color: #28a745">${analysis.correctAnswers}개</strong></div>
                <div>오답: <strong style="color: #dc3545">${analysis.incorrectAnswers}개</strong></div>
            </div>
        `;

        // 유형별 통계
        if (Object.keys(analysis.typeStats).length > 0) {
            html += '<div style="font-weight: bold; margin: 10px 0 5px 0; color: #667eea;">📈 유형별 분석</div>';
            Object.keys(analysis.typeStats).forEach(type => {
                const stat = analysis.typeStats[type];
                const acc = ((stat.correct / stat.total) * 100).toFixed(1);
                const typeText = type === 'addition' ? '덧셈' : type === 'subtraction' ? '뺄셈' :
                               type === 'multiplication' ? '곱셈' : '나눗셈';
                const color = acc >= 70 ? '#28a745' : acc >= 50 ? '#ffc107' : '#dc3545';
                html += `<div style="margin: 3px 0; padding: 3px; background: white; border-radius: 4px;">
                    ${typeText}: ${stat.total}문제 (<span style="color: ${color}; font-weight: bold;">${acc}%</span>)
                </div>`;
            });
        }

        // 약점 표시
        if (analysis.weaknesses.length > 0) {
            html += '<div style="font-weight: bold; margin: 10px 0 5px 0; color: #dc3545;">⚠️ 약점 분야</div>';
            analysis.weaknesses.forEach(weakness => {
                const typeText = weakness.type === 'addition' ? '덧셈' : weakness.type === 'subtraction' ? '뺄셈' :
                               weakness.type === 'multiplication' ? '곱셈' : '나눗셈';
                html += `<div style="margin: 3px 0; padding: 5px; background: #fff3cd; border-radius: 4px; color: #856404;">
                    ${typeText}: 정답률 ${weakness.accuracy}% (${weakness.incorrect}개 틀림)
                </div>`;
            });
        }

        // AI 분석 표시
        if (analysis.aiAnalysis && analysis.aiAnalysis !== '자동 분석을 생성할 수 없습니다.') {
            html += `<div style="font-weight: bold; margin: 10px 0 5px 0; color: #667eea;">🤖 AI 분석</div>
                     <div style="background: white; padding: 8px; border-radius: 4px; font-size: 11px; line-height: 1.5; white-space: pre-wrap;">${analysis.aiAnalysis}</div>`;
        }

        statsContent.innerHTML = html;

    } catch (error) {
        console.error('분석 오류:', error);
        statsContent.innerHTML = '<div style="text-align:center; color: #dc3545;">분석 실패</div>';
    } finally {
        analyzeBtn.disabled = false;
    }
};

window.addEventListener('message', function(event) {
    if (event.data.type === 'answer_submitted') {
        const { studentId, answer, correct, correctAnswer } = event.data;
        const resultBox = document.getElementById(`result-${studentId}`);
        resultBox.className = `result-box show ${correct ? 'correct' : 'incorrect'}`;
        document.getElementById(`result-icon-${studentId}`).textContent = correct ? '🎉' : '❌';
        document.getElementById(`result-text-${studentId}`).textContent = correct ? '정답입니다!' : '틀렸습니다!';
        document.getElementById(`result-detail-${studentId}`).textContent = `제출: ${answer} | 정답: ${correctAnswer}`;
        updateStatus(studentId, correct ? 'ready' : 'answered', correct ? '정답!' : '오답');
        document.getElementById(`generate-${studentId}`).disabled = false;
        document.getElementById(`personalized-${studentId}`).disabled = false;
    }
});

window.addEventListener('load', async () => {
    try {
        const response = await fetch(`${API_BASE}/health`);
        console.log('✅ Backend ready:', await response.json());
    } catch (error) {
        alert('⚠️ 백엔드 서버를 실행해주세요! (npm start in backend folder)');
    }
});
