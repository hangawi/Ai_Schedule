var _data = {
    videoView: false,
    pageMove: false,
    quizs: [
        {
            seq: 1,
            url: "bingo_addition/start.html",
            teacher: true,
            teacherSeq: 0,
            activepage: [1], // 선생님 내려주기 버튼이 필요한 페이지
            sendshare: [],
            conceptool: [],
            concepkey: [],
            path: "bingo_addition"
        },
        {
            seq: 2,
            url: "bingo_addition/s_index.html",
            teacher: false,
            teacherSeq: 1,
            activepage: [1], // 학생 활동 페이지 갯수
            sendshare: [], // 샌드앤쉐어 사용하는 페이지 넘버 (선생님만)
            conceptool: [], // 컨셉툴 사용하는 페이지 넘버 (선생님만)
            concepkey: [], // 키번호 배열 (선생님만)
            path: "bingo_addition"
        },
    ]
};