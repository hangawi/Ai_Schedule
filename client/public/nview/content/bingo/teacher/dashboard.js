console.log('✅ dashboard.js 파일 로드 시작');

const API_BASE = 'http://localhost:5000/api/nview';

let currentStudent = '';
let currentPeriod = 'all'; // 랭킹은 전체 기간으로 표시
let trendChart = null;
let typeChart = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOMContentLoaded 이벤트 발생');

    document.getElementById('studentSelect').addEventListener('change', (e) => {
        currentStudent = e.target.value;
        if (currentStudent) {
            loadDashboard();
            loadAIAnalysis();
        } else {
            // 학생 선택 해제 시 AI 분석 초기화
            const container = document.getElementById('aiAnalysisContainer');
            if (container) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👆</div><div>학생을 선택하면 AI 학습 분석을 볼 수 있습니다.</div></div>';
            }
        }
    });

    document.getElementById('periodSelect').addEventListener('change', (e) => {
        currentPeriod = e.target.value;
        if (currentStudent) {
            loadDashboard();
        }
    });

    // 초기 AI 분석 로드 (학생 선택되지 않았으면 안내 표시)
    console.log('🤖 loadAIAnalysis() 호출 시도');
    loadAIAnalysis();
});

// 대시보드 전체 데이터 로드
async function loadDashboard() {
    if (!currentStudent) return;

    showLoading();

    try {
        // 대시보드 데이터 로드
        const dashboardRes = await fetch(`${API_BASE}/dashboard/${currentStudent}?period=${currentPeriod}`);
        const dashboardData = await dashboardRes.json();

        if (!dashboardData.hasData) {
            showEmptyState();
            return;
        }

        // 추이 데이터 로드
        const trendsRes = await fetch(`${API_BASE}/dashboard/trends/${currentStudent}?type=daily&days=7`);
        const trendsData = await trendsRes.json();

        // 학습 이력 로드
        const historyRes = await fetch(`${API_BASE}/learning-history/${currentStudent}?limit=20`);
        const historyData = await historyRes.json();

        // UI 업데이트
        updateKPI(dashboardData.kpi);
        updateTrendChart(trendsData.trends);
        updateTypeChart(dashboardData.typeStats);
        updateTypeStatsTable(dashboardData.typeStats);
        updateWrongAnswers(dashboardData.recentWrong);
        updateHistory(historyData.history);

        hideLoading();

    } catch (error) {
        console.error('대시보드 로드 오류:', error);
        alert('대시보드를 불러오는데 실패했습니다.');
        hideLoading();
    }
}

// KPI 카드 업데이트
function updateKPI(kpi) {
    document.getElementById('kpi-total').textContent = kpi.totalQuestions;
    document.getElementById('kpi-accuracy').textContent = kpi.accuracy + '%';

    // 초 단위로 표시
    document.getElementById('kpi-time').textContent = kpi.totalTime + '초';
    document.getElementById('kpi-avg-time').textContent = kpi.avgTime + '초';

    document.getElementById('kpi-streak').textContent = kpi.streak + '일';
}

// 학습 추이 그래프 업데이트
function updateTrendChart(trends) {
    const ctx = document.getElementById('trendChart');

    if (trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trends.map(t => t.label),
            datasets: [
                {
                    label: '정답률 (%)',
                    data: trends.map(t => t.accuracy),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: '학습량 (문제수)',
                    data: trends.map(t => t.total),
                    borderColor: '#f5576c',
                    backgroundColor: 'rgba(245, 87, 108, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                                if (context.datasetIndex === 0) {
                                    label += '%';
                                } else {
                                    label += '개';
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '정답률 (%)'
                    },
                    min: 0,
                    max: 100
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '학습량 (문제수)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// 유형별 정답률 차트 업데이트
function updateTypeChart(typeStats) {
    const ctx = document.getElementById('typeChart');

    const typeNames = {
        addition: '덧셈',
        subtraction: '뺄셈',
        multiplication: '곱셈',
        division: '나눗셈'
    };

    const types = Object.keys(typeStats).filter(type => typeStats[type].total > 0);
    const labels = types.map(type => typeNames[type]);
    const accuracies = types.map(type => parseFloat(typeStats[type].accuracy));

    if (typeChart) {
        typeChart.destroy();
    }

    typeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: accuracies,
                backgroundColor: [
                    '#667eea',
                    '#f5576c',
                    '#4facfe',
                    '#ffc107'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return `${label}: ${value}%`;
                        }
                    }
                }
            }
        }
    });
}

// 유형별 상세 통계 테이블 업데이트
function updateTypeStatsTable(typeStats) {
    const tbody = document.querySelector('#typeStatsTable tbody');
    tbody.innerHTML = '';

    const typeNames = {
        addition: '덧셈',
        subtraction: '뺄셈',
        multiplication: '곱셈',
        division: '나눗셈'
    };

    Object.keys(typeStats).forEach(type => {
        const stat = typeStats[type];
        if (stat.total === 0) return;

        const accuracy = parseFloat(stat.accuracy);
        let badgeClass = 'accuracy-high';
        if (accuracy < 60) badgeClass = 'accuracy-low';
        else if (accuracy < 80) badgeClass = 'accuracy-medium';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="type-name">${typeNames[type]}</td>
            <td>${stat.total}개</td>
            <td><span class="accuracy-badge ${badgeClass}">${stat.accuracy}%</span></td>
            <td>${stat.avgTime}초</td>
        `;
        tbody.appendChild(row);
    });
}

// 최근 오답 업데이트
function updateWrongAnswers(wrongAnswers) {
    const container = document.getElementById('wrongAnswersContainer');

    if (wrongAnswers.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎉</div><div>틀린 문제가 없습니다!</div></div>';
        return;
    }

    const typeNames = {
        addition: '덧셈',
        subtraction: '뺄셈',
        multiplication: '곱셈',
        division: '나눗셈'
    };

    const difficultyNames = {
        easy: '쉬움',
        medium: '보통',
        hard: '어려움'
    };

    container.innerHTML = wrongAnswers.map(item => {
        const timeAgo = getTimeAgo(new Date(item.timestamp));
        return `
            <div class="wrong-answer-item">
                <div class="wrong-question">${item.question}</div>
                <div class="wrong-details">
                    <span>학생 답: <span class="wrong-answer">${item.studentAnswer}</span></span>
                    <span>정답: <span class="correct-answer">${item.answer}</span></span>
                    <span>${typeNames[item.type]} | ${difficultyNames[item.difficulty]}</span>
                    <span>${item.timeSpent}초</span>
                    <span>${timeAgo}</span>
                </div>
            </div>
        `;
    }).join('');
}

// 학습 이력 테이블 업데이트
function updateHistory(history) {
    const tbody = document.getElementById('historyTableBody');

    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:#999;">학습 이력이 없습니다.</td></tr>';
        return;
    }

    const typeNames = {
        addition: '덧셈',
        subtraction: '뺄셈',
        multiplication: '곱셈',
        division: '나눗셈'
    };

    const difficultyNames = {
        easy: '쉬움',
        medium: '보통',
        hard: '어려움'
    };

    tbody.innerHTML = history.map(item => {
        const date = new Date(item.timestamp);
        const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
        const resultClass = item.correct ? 'result-correct' : 'result-incorrect';
        const resultText = item.correct ? '✅' : '❌';

        return `
            <tr>
                <td>${dateStr}</td>
                <td>${item.questionData.question}</td>
                <td>${typeNames[item.questionData.type]}</td>
                <td>${difficultyNames[item.questionData.difficulty]}</td>
                <td class="${resultClass}">${resultText}</td>
                <td>${item.timeSpent}초</td>
            </tr>
        `;
    }).join('');
}

// AI 분석 로드 (학생 선택 시 호출됨)
async function loadAIAnalysis() {
    console.log('🤖 AI 분석 로드 시작...');

    if (!currentStudent) {
        console.log('⚠️ 학생이 선택되지 않음');
        const container = document.getElementById('aiAnalysisContainer');
        if (container) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👆</div><div>학생을 선택하면 AI 학습 분석을 볼 수 있습니다.</div></div>';
        }
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/analyze-student/${currentStudent}`);
        const analysis = await res.json();

        console.log('✅ AI 분석 데이터 수신:', analysis);
        updateAIAnalysis(analysis);
    } catch (error) {
        console.error('❌ AI 분석 로드 오류:', error);
        const container = document.getElementById('aiAnalysisContainer');
        if (container) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div>AI 분석을 불러오는데 실패했습니다.</div></div>';
        }
    }
}

// AI 분석 업데이트
function updateAIAnalysis(analysis) {
    console.log('📊 AI 분석 업데이트 시작:', analysis);
    const container = document.getElementById('aiAnalysisContainer');

    if (!container) {
        console.error('❌ aiAnalysisContainer 요소를 찾을 수 없습니다!');
        return;
    }

    if (analysis.totalQuestions === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div>아직 학습 데이터가 없습니다.</div></div>';
        return;
    }

    // AI 분석 표시
    let html = `
        <div style="padding: 15px; background: #f8f9fa; border-radius: 10px; margin-bottom: 10px;">
            <div style="font-weight: bold; margin-bottom: 10px; color: #667eea; font-size: 16px;">📊 학습 통계</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div>총 문제: <strong>${analysis.totalQuestions}개</strong></div>
                <div>정답률: <strong style="color: ${analysis.accuracy >= 70 ? '#28a745' : analysis.accuracy >= 50 ? '#ffc107' : '#dc3545'}">${analysis.accuracy}%</strong></div>
                <div>정답: <strong style="color: #28a745">${analysis.correctAnswers}개</strong></div>
                <div>오답: <strong style="color: #dc3545">${analysis.incorrectAnswers}개</strong></div>
            </div>
        </div>
    `;

    // 유형별 통계
    if (Object.keys(analysis.typeStats).length > 0) {
        html += '<div style="padding: 15px; background: #f8f9fa; border-radius: 10px; margin-bottom: 10px;">';
        html += '<div style="font-weight: bold; margin-bottom: 10px; color: #667eea; font-size: 16px;">📈 유형별 분석</div>';
        Object.keys(analysis.typeStats).forEach(type => {
            const stat = analysis.typeStats[type];
            const acc = ((stat.correct / stat.total) * 100).toFixed(1);
            const typeText = type === 'addition' ? '덧셈' : type === 'subtraction' ? '뺄셈' :
                           type === 'multiplication' ? '곱셈' : '나눗셈';
            const color = acc >= 70 ? '#28a745' : acc >= 50 ? '#ffc107' : '#dc3545';
            html += `<div style="margin: 5px 0; padding: 8px; background: white; border-radius: 5px;">
                ${typeText}: ${stat.total}문제 (<span style="color: ${color}; font-weight: bold;">${acc}%</span>)
            </div>`;
        });
        html += '</div>';
    }

    // 약점 표시
    if (analysis.weaknesses && analysis.weaknesses.length > 0) {
        html += '<div style="padding: 15px; background: #fff3cd; border-radius: 10px; margin-bottom: 10px;">';
        html += '<div style="font-weight: bold; margin-bottom: 10px; color: #dc3545; font-size: 16px;">⚠️ 약점 분야</div>';
        analysis.weaknesses.forEach(weakness => {
            const typeText = weakness.type === 'addition' ? '덧셈' : weakness.type === 'subtraction' ? '뺄셈' :
                           weakness.type === 'multiplication' ? '곱셈' : '나눗셈';
            html += `<div style="margin: 5px 0; padding: 8px; background: white; border-radius: 5px; color: #856404;">
                ${typeText}: 정답률 ${weakness.accuracy}% (${weakness.incorrect}개 틀림)
            </div>`;
        });
        html += '</div>';
    }

    // AI 분석 표시
    if (analysis.aiAnalysis && analysis.aiAnalysis !== '자동 분석을 생성할 수 없습니다.') {
        html += '<div style="padding: 15px; background: #e7f3ff; border-radius: 10px;">';
        html += '<div style="font-weight: bold; margin-bottom: 10px; color: #667eea; font-size: 16px;">🤖 AI 분석</div>';
        html += `<div style="background: white; padding: 12px; border-radius: 5px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${analysis.aiAnalysis}</div>`;
        html += '</div>';
    }

    container.innerHTML = html;
}

// 시간 차이 계산
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    return `${diffDays}일 전`;
}

// 로딩 상태 표시
function showLoading() {
    // 간단히 구현
}

function hideLoading() {
    // 간단히 구현
}

function showEmptyState() {
    document.getElementById('kpi-total').textContent = '0';
    document.getElementById('kpi-accuracy').textContent = '0%';
    document.getElementById('kpi-time').textContent = '0분';
    document.getElementById('kpi-avg-time').textContent = '0초';
    document.getElementById('kpi-streak').textContent = '0일';

    if (trendChart) trendChart.destroy();
    if (typeChart) typeChart.destroy();

    document.querySelector('#typeStatsTable tbody').innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#999;">데이터가 없습니다.</td></tr>';
    document.getElementById('wrongAnswersContainer').innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><div>아직 학습 데이터가 없습니다.<br>문제를 풀어보세요!</div></div>';
    document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:#999;">학습 이력이 없습니다.</td></tr>';
}

// 주기적으로 AI 분석 업데이트 및 선택된 학생 대시보드 리로드
setInterval(() => {
    // 학생이 선택된 경우 대시보드 및 AI 분석 자동 리로드
    if (currentStudent) {
        loadDashboard();
        loadAIAnalysis();
    }
}, 10000); // 10초마다 자동 리로드
