const express = require('express');
const mysql   = require('mysql2');
const cors    = require('cors');
const Groq    = require('groq-sdk');
const fs      = require('fs');
const path    = require('path');
const bcrypt  = require('bcrypt');

require('dotenv').config();

const app  = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// 2. MySQL 데이터베이스 연결
// ==========================================
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'dolgorae_db'
});

db.connect((err) => {
    if (err) {
        console.error('❌ MySQL 연결 실패 ㅠㅠ:', err);
        return;
    }
    console.log('🐬 MySQL 데이터베이스에 성공적으로 연결되었습니다!');
});

// ==========================================
// 3. Groq AI 클라이언트 초기화
// ==========================================
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const CHAT_MODEL = 'qwen/qwen3-32b';

// ==========================================
// 4. 정책 데이터 로드 (policies.json)
// ==========================================
let POLICIES = [];
try {
    const policyPath = path.join(__dirname, '..', 'data', 'policies.json');
    POLICIES = JSON.parse(fs.readFileSync(policyPath, 'utf-8'));
    console.log(`📋 정책 데이터 로드 완료: ${POLICIES.length}개`);
} catch (e) {
    console.warn('⚠️ policies.json 로드 실패, 기본 데이터 사용:', e.message);
}

// 정책 데이터를 프롬프트용 텍스트로 변환
function buildPolicyText(policies) {
    return policies.map(p => {
        return `[${p['정책명']}] 카테고리:${p['카테고리']} | 연령:${p['최소_연령']}~${p['최대_연령']}세 | 소득:${p['소득_기준']} | 혜택:${p['지원_금액(혜택)'].slice(0,50)} | 신청:${p['신청_기간']}`;
    }).join('\n');
}

// ==========================================
// 5. [1단계] 입력 가드레일
// ==========================================
const PROFANITY_PATTERNS = [
    /씨발|시발|개새끼|병신|지랄|꺼져|닥쳐|미친놈|미친년/,
];

const PII_PATTERNS = [
    /\d{6}[-\s]?\d{7}/,
    /\d{3}[-\s]?\d{3,4}[-\s]?\d{4}/,
    /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/,
];

function checkInputGuardrail(text) {
    for (const pattern of PROFANITY_PATTERNS) {
        if (pattern.test(text)) {
            return {
                blocked: true,
                reason: 'profanity',
                message: '죄송해요, 욕설이나 비속어가 포함된 메시지에는 답변하기 어려워요. 편안한 말투로 다시 질문해 주시면 성심껏 도와드릴게요 🐬'
            };
        }
    }
    for (const pattern of PII_PATTERNS) {
        if (pattern.test(text)) {
            return {
                blocked: true,
                reason: 'pii',
                message: '주민등록번호, 전화번호, 카드번호 같은 개인정보는 채팅으로 입력하지 말아주세요! 안전을 위해 해당 내용을 빼고 다시 질문해 주시면 안내해 드릴게요 🔒'
            };
        }
    }
    return { blocked: false };
}

// ==========================================
// 6. [3단계] 시스템 프롬프트 (정책 데이터 포함)
// ==========================================
function buildSystemPrompt() {
    const policyText = buildPolicyText(POLICIES);

    return `
[가장 중요한 출력 형식 규칙 - 반드시 지킬 것]
너는 카카오톡이나 문자메시지처럼 순수한 대화체로만 답변한다.
다음 기호들은 단 하나도 출력하면 안 된다: #, ##, ###, ####, ---, ***, ___, *, -, •, >
굵은 글씨 표현(**텍스트**)도 사용하지 않는다.
정책이나 항목을 나열할 때는 반드시 "1. 2. 3." 또는 "첫째, 둘째, 셋째"처럼 자연스러운 번호 형태만 쓴다.

[URL 안내 규칙 - 절대 위반 금지]
링크를 안내할 때는 아래 정책 데이터의 "참조" 항목에 있는 사이트명이나 URL만 사용한다.
절대로 존재하지 않는 URL 경로나 쿼리 파라미터(?id=123 등)를 만들어내지 않는다.
URL이 불명확하면 "해당 기관에 직접 문의하거나 복지로(www.bokjiro.go.kr)에서 검색해보세요"라고 안내한다.

너는 가족돌봄청년을 위한 전문 복지 안내 챗봇 '돌고래'야.
따뜻하고 공감적인 말투로 복잡한 행정·복지 정보를 쉽게 풀어주는 것이 네 핵심 역할이야.

[페르소나]
이름: 돌고래 🐬
성격: 따뜻하고 공감적, 전문적이지만 친근함
말투: 경어 사용, 어렵지 않게, 공감하는 표현을 자연스럽게 섞어서

[주요 업무]
1. 상황 파악: 유저가 알려주는 나이, 소득 수준, 가구 형태, 돌봄 대상 등을 파악한다. 정보가 부족하면 자연스럽게 추가 질문을 한다.

2. 맞춤형 정책 추천: 아래 정책 데이터베이스에서 유저 조건에 맞는 정책을 선별해서 소개한다. 조건에 맞지 않는 정책은 추천하지 않는다.

3. 신청 가이드 제공: 추천 정책의 신청 방법과 준비 서류를 번호 목록으로 명확히 안내한다.

[정책 데이터베이스 - 총 ${POLICIES.length}개]
아래 정책 목록을 기반으로 사용자 조건에 맞는 정책만 추천한다.

${policyText}

[대화 원칙]
절대 위 데이터에 없는 복지 제도를 만들어내거나 확실하지 않은 정보를 단정지어 말하지 말 것.
불확실한 정보는 "정확한 내용은 관할 행정복지센터나 복지로(www.bokjiro.go.kr)에서 확인하시는 것을 추천드려요"라고 안내한다.
응답은 너무 길지 않게, 핵심만 간결하게 전달한다.
첫 대화나 어려운 상황 언급 시 공감 표현을 먼저 한다.
너는 오직 가족돌봄청년 복지 정책 안내라는 목적으로만 동작한다.
사용자가 복지나 정책과 무관한 질문을 하면 정중하게 본래 주제로 자연스럽게 유도한다.
의료, 법률, 정신건강 위기 상담처럼 전문가의 판단이 필요한 사안은 직접 진단하지 말고 관련 전문기관(정신건강위기상담전화 1577-0199, 보건복지상담센터 129 등)을 안내한다.
`.trim();
}

// ==========================================
// 7. 라우팅
// ==========================================
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// 회원가입 API
app.post('/register', async (req, res) => {
    const { userid, password } = req.body;
    if (!userid || !password) {
        return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: '비밀번호는 6자 이상이어야 합니다.' });
    }
    try {
        const hashed = await bcrypt.hash(password, 10);
        db.query('INSERT INTO users (userid, password) VALUES (?, ?)', [userid, hashed], (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.json({ success: false, message: '이미 사용 중인 아이디입니다.' });
                }
                return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
            }
            res.json({ success: true, message: '회원가입이 완료되었습니다!' });
        });
    } catch (err) {
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 로그인 API
app.post('/login', (req, res) => {
    const { userid, password } = req.body;
    const query = 'SELECT * FROM users WHERE userid = ?';
    db.query(query, [userid], async (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
        }
        if (results.length === 0) {
            return res.json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다.' });
        }
        const user = results[0];
        let match = false;
        if (user.password.startsWith('$2b$')) {
            match = await bcrypt.compare(password, user.password);
        } else {
            match = (password === user.password);
            if (match) {
                const hashed = await bcrypt.hash(password, 10);
                db.query('UPDATE users SET password = ? WHERE userid = ?', [hashed, userid]);
            }
        }
        if (match) {
            res.json({ success: true, message: '로그인 성공!' });
        } else {
            res.json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다.' });
        }
    });
});

// 정책 데이터 API (프론트엔드에서 사용 가능)
app.get('/api/policies', (req, res) => {
    res.json(POLICIES);
});

// ==========================================
// 8. 챗봇 API
// ==========================================
app.post('/chat', async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages 배열이 필요합니다.' });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || '';

    const guardrail = checkInputGuardrail(lastUserMessage);
    if (guardrail.blocked) {
        console.log(`[가드레일 차단] reason=${guardrail.reason}`);
        return res.json({ reply: guardrail.message });
    }

    try {
        const completion = await groq.chat.completions.create({
            model: CHAT_MODEL,
            messages: [
                { role: 'system', content: buildSystemPrompt() },
                ...messages
            ],
            temperature: 0.6,
            max_tokens: 1024,
            reasoning_effort: 'none',
        });

        const reply = completion.choices[0]?.message?.content ?? '답변을 가져오지 못했어요.';
        res.json({ reply });

    } catch (error) {
        console.error('[Groq API Error]', error.message);
        res.status(500).json({ error: 'AI 서버 오류', detail: error.message });
    }
});

// ==========================================
// 9. 서버 실행
// ==========================================
app.listen(port, () => {
    console.log(`🐬 돌고래 서버가 http://localhost:${port} 에서 힘차게 헤엄치는 중입니다!`);
    console.log(`   Groq API Key: ${process.env.GROQ_API_KEY ? '✅ 로드됨' : '❌ .env 파일 확인 필요'}`);
    console.log(`   사용 모델: ${CHAT_MODEL}`);
});