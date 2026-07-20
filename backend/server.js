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

// ==========================================
// 1. 서버 환경 설정
// ==========================================
app.use(cors());

// [보안 5] 대용량 페이로드 차단 - 100KB 이상 요청은 바로 거절
// 이유: 100KB 이상 요청이 Groq API로 넘어가면 토큰 초과로 서버가 크래시됨
app.use(express.json({ limit: '100kb' }));
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
const CHAT_MODEL = 'llama-3.3-70b-versatile';

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

// [개선 2] 사용자 조건으로 1차 필터링 후 AI에 넘기기
// 이유: 43개를 전부 넘기면 토큰 낭비 + 조건 안 맞는 정책까지 AI가 읽어서 환각 위험
// 나이, 소득, 카테고리 키워드로 미리 걸러내고 맞는 것만 프롬프트에 포함
// [개선 7] 마이페이지 프로필을 받아 나이·소득으로 정밀 필터링
// profile 예: { age:'26', income:'2순위', region:'서울', household:'1인가구', careElderly:true }
function filterPolicies(userMessage, profile = null) {
    // 나이: 프로필이 있으면 우선 사용, 없으면 메시지에서 추출 (예: "25살", "25세")
    const ageMatch = userMessage.match(/(\d+)\s*(?:살|세)/);
    const profileAge = profile && parseInt(profile.age, 10);
    const age = Number.isFinite(profileAge) ? profileAge
              : (ageMatch ? parseInt(ageMatch[1]) : null);

    // 소득 키워드 추출
    const highIncome = /150%|고소득|중위소득\s*15|소득\s*높|소득\s*제한\s*없/.test(userMessage);
    const lowIncome  = /60%|100%|저소득|중위소득\s*[16]|기초생활|차상위/.test(userMessage);

    // 카테고리 키워드
    const keywords = {
        돌봄: /돌봄|돌봐|간병|치매|장애|요양/.test(userMessage),
        주거: /월세|주거|집|임대|전세|보증/.test(userMessage),
        취업: /취업|일자리|직업|구직|알바|자격증/.test(userMessage),
        금융: /저축|계좌|도약|금융|적금/.test(userMessage),
        생활: /생활|식비|의료|건강|문화/.test(userMessage),
    };

    const activeCategories = Object.keys(keywords).filter(k => keywords[k]);

    let filtered = POLICIES;

    // 나이 조건 필터
    if (age !== null) {
        const ageFiltered = filtered.filter(p => {
            const min = parseInt(p['최소_연령']) || 0;
            const max = parseInt(p['최대_연령']) || 99;
            return age >= min && age <= max;
        });
        // 필터링 후 결과가 있으면 적용, 없으면 전체 유지
        if (ageFiltered.length > 0) filtered = ageFiltered;
    }

    // [개선 7] 소득 조건 필터 (프로필이 있을 때만, 확실히 미달인 경우만 제외)
    if (profile && INCOME_FLOOR[profile.income] !== undefined) {
        const floor = INCOME_FLOOR[profile.income];
        const incFiltered = filtered.filter(p => {
            const ceil = policyIncomeCeil(p['소득_기준']);
            return ceil === null || floor <= ceil;   // 비교 불가하면 유지
        });
        if (incFiltered.length > 0) filtered = incFiltered;
    }

    // 카테고리 필터 (키워드가 있을 때만)
    if (activeCategories.length > 0) {
        const catFiltered = filtered.filter(p =>
            activeCategories.includes(p['카테고리'])
        );
        if (catFiltered.length > 0) filtered = catFiltered;
    }

    // 최대 15개로 제한 (토큰 절약)
    return filtered.slice(0, 15);
}

// 소득 구간 → 사용자의 최소 중위소득 %(하한선). 하한선보다 낮은 기준을 요구하면 자격 미달
const INCOME_FLOOR = { '1순위': 0, '2순위': 120, '전체': 150 };

// 정책의 소득 기준에서 '중위소득 N%' 추출 (제한없음/비교 불가 → null)
function policyIncomeCeil(text) {
    const s = (text || '').replace(/\s/g, '');
    if (!s || s === '-' || s.includes('제한없음')) return null;
    const m = s.match(/중위소득(\d+)%/);
    return m ? parseInt(m[1], 10) : null;
}

// 프로필을 프롬프트용 텍스트로 변환
function buildProfileText(profile) {
    if (!profile || !profile.age) return '';
    const INCOME_TEXT = {
        '1순위': '기준 중위소득 120% 이하',
        '2순위': '기준 중위소득 120~150%',
        '전체':  '기준 중위소득 150% 초과',
    };
    const care = [];
    if (profile.careInfant)   care.push('영유아');
    if (profile.careElderly)  care.push('노인');
    if (profile.careDisabled) care.push('장애인');

    return [
        '[사용자 프로필 - 마이페이지에 저장된 정보]',
        `나이: 만 ${profile.age}세`,
        `거주 지역: ${profile.region || '미입력'}`,
        `소득 수준: ${INCOME_TEXT[profile.income] || profile.income || '미입력'}`,
        `취업 상태: ${profile.employment || '미입력'}`,
        `가구 형태: ${profile.household || '미입력'}`,
        `돌봄 대상: ${care.length ? care.join(', ') : '없음'}`,
        '이 정보는 이미 확인되었으므로 나이·소득·가구 형태를 다시 묻지 말고 바로 맞춤 정책을 안내한다.',
    ].join('\n');
}

// 정책 데이터를 프롬프트용 텍스트로 변환
function buildPolicyText(policies) {
    return policies.map(p => {
        return `[${p['정책명']}] 카테고리:${p['카테고리']} | 연령:${p['최소_연령']}~${p['최대_연령']}세 | 소득:${p['소득_기준']} | 혜택:${p['지원_금액(혜택)'].slice(0,50)} | 신청:${p['신청_기간']} | 서류:${(p['제출_서류'] || '').slice(0,60)}`;
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

// [개선 6] 마지막 메시지만 검사 → 전체 대화 이력 검사
// 이유: 대화 중간에 악성 내용을 끼워넣으면 마지막만 검사하면 통과됨
function checkInputGuardrail(messages) {
    const allText = messages.map(m => m.content || '').join(' ');

    for (const pattern of PROFANITY_PATTERNS) {
        if (pattern.test(allText)) {
            return {
                blocked: true,
                reason: 'profanity',
                message: '죄송해요, 욕설이나 비속어가 포함된 메시지에는 답변하기 어려워요. 편안한 말투로 다시 질문해 주시면 성심껏 도와드릴게요 🐬'
            };
        }
    }
    for (const pattern of PII_PATTERNS) {
        if (pattern.test(allText)) {
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
// 6. [3단계] 시스템 프롬프트
// ==========================================
function buildSystemPrompt(filteredPolicies, profile = null) {
    const policyText = buildPolicyText(filteredPolicies);
    const profileText = buildProfileText(profile);

    return `
[가장 중요한 출력 형식 규칙 - 반드시 지킬 것]
너는 카카오톡이나 문자메시지처럼 순수한 대화체로만 답변한다.
다음 기호들은 단 하나도 출력하면 안 된다: #, ##, ###, ####, ---, ***, ___, *, -, •, >
굵은 글씨 표현(**텍스트**)도 사용하지 않는다.
정책이나 항목을 나열할 때는 반드시 "1. 2. 3." 또는 "첫째, 둘째, 셋째"처럼 자연스러운 번호 형태만 쓴다.

[URL 안내 규칙 - 절대 위반 금지]
링크를 안내할 때는 아래 정책 데이터의 참조 항목에 있는 사이트명이나 URL만 사용한다.
절대로 존재하지 않는 URL 경로나 쿼리 파라미터를 만들어내지 않는다.
URL이 불명확하면 "해당 기관에 직접 문의하거나 복지로(www.bokjiro.go.kr)에서 검색해보세요"라고 안내한다.

너는 가족돌봄청년을 위한 전문 복지 안내 챗봇 '돌고래'야.
따뜻하고 공감적인 말투로 복잡한 행정·복지 정보를 쉽게 풀어주는 것이 네 핵심 역할이야.

[페르소나]
이름: 돌고래 🐬
성격: 따뜻하고 공감적, 전문적이지만 친근함
말투: 경어 사용, 어렵지 않게, 공감하는 표현을 자연스럽게 섞어서

[주요 업무]
1. 상황 파악: 유저가 알려주는 나이, 소득 수준, 가구 형태, 돌봄 대상 등을 파악한다. 정보가 부족하면 자연스럽게 추가 질문을 한다.

2. 맞춤형 정책 추천 - 중요 규칙:
아래 정책 데이터베이스에서 유저 조건에 맞는 정책만 선별해서 소개한다.
사용자의 나이가 정책의 연령 범위를 벗어나면 절대 추천하지 않는다.
사용자의 가구 형태나 돌봄 대상이 정책의 가구수_조건과 맞지 않으면 절대 추천하지 않는다.
예를 들어 "영아 양육 가구" 조건인 정책을 치매 할머니를 돌보는 사람에게 추천하면 안 된다.
추천 전에 반드시 가구수_조건을 확인하고, 맞지 않으면 해당 정책을 제외한다.
예를 들어 중위소득 150% 사용자에게 "중위소득 100% 이하" 대상 정책을 추천하는 것은 심각한 오류다.
추천 전에 반드시 소득 조건을 확인하고, 조건 미달이면 "이 정책은 소득 기준 초과로 해당되지 않아요"라고 안내한다.
조건에 맞지 않는 정책을 추천하는 것은 사용자에게 큰 혼란을 주므로 반드시 지켜야 한다.

3. 서류 안내: 사용자가 특정 정책의 서류나 신청 방법을 물으면, 아래 데이터의 서류 항목을 번호 목록으로 직접 안내한다. 절대 "어떤 어려움을 겪고 계신지 알려주세요"처럼 회피하지 않는다.

${profileText}

[정책 데이터베이스 - ${filteredPolicies.length}개 조건 매칭]
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
 
// 정책 데이터 API
app.get('/api/policies', (req, res) => {
    res.json(POLICIES);
});
 
// ==========================================
// 커뮤니티 API (posts 테이블)
// ==========================================
app.get('/posts', (req, res) => {
    const { category, search } = req.query;
    let query = 'SELECT * FROM posts';
    const params = [];
    const conditions = [];
    if (category && category !== '전체') { conditions.push('category = ?'); params.push(category); }
    if (search) { conditions.push('(title LIKE ? OR content LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';
    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: '조회 실패' });
        res.json(results);
    });
});
 
app.post('/posts', (req, res) => {
    const { userid, category, title, content } = req.body;
    if (!userid || !category || !title || !content) {
        return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }
    db.query(
        'INSERT INTO posts (userid, category, title, content) VALUES (?, ?, ?, ?)',
        [userid, category, title, content],
        (err, result) => {
            if (err) return res.status(500).json({ error: '작성 실패' });
            res.json({ success: true, id: result.insertId });
        }
    );
});
 
app.post('/posts/:id/like', (req, res) => {
    db.query('UPDATE posts SET likes = likes + 1 WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: '좋아요 실패' });
        res.json({ success: true });
    });
});
 
app.get('/posts/:id/comments', (req, res) => {
    db.query(
        'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC',
        [req.params.id],
        (err, results) => {
            if (err) return res.status(500).json({ error: '댓글 조회 실패' });
            res.json(results);
        }
    );
});
 
app.post('/posts/:id/comments', (req, res) => {
    const { userid, content } = req.body;
    if (!userid || !content) {
        return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
    }
    db.query(
        'INSERT INTO comments (post_id, userid, content) VALUES (?, ?, ?)',
        [req.params.id, userid, content],
        (err, result) => {
            if (err) return res.status(500).json({ error: '댓글 작성 실패' });
            res.json({ success: true, id: result.insertId });
        }
    );
});
 
// ==========================================
// 8. 챗봇 API
// ==========================================
app.post('/chat', async (req, res) => {
    const { messages, profile } = req.body;   // [개선 7] 마이페이지 프로필 수신
 
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages 배열이 필요합니다.' });
    }
 
    // [개선 6] 전체 대화 이력 가드레일 검사
    const guardrail = checkInputGuardrail(messages);
    if (guardrail.blocked) {
        console.log(`[가드레일 차단] reason=${guardrail.reason}`);
        return res.json({ reply: guardrail.message });
    }
 
    // [개선 2] 마지막 사용자 메시지 기준으로 정책 1차 필터링
    const lastUserMessage = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
    const filteredPolicies = filterPolicies(lastUserMessage, profile);
    console.log(`[정책 필터링] ${POLICIES.length}개 → ${filteredPolicies.length}개` +
        (profile?.age ? ` (프로필 적용: 만 ${profile.age}세 / ${profile.income})` : ''));
 
    try {
        const completion = await groq.chat.completions.create({
            model: CHAT_MODEL,
            messages: [
                { role: 'system', content: buildSystemPrompt(filteredPolicies, profile) },
                ...messages
            ],
            temperature: 0.6,
            max_tokens: 1024,
            // [개선 1] reasoning_effort 제거 - Llama 모델은 이 파라미터 지원 안 함
        });
 
        const reply = completion.choices[0]?.message?.content ?? '답변을 가져오지 못했어요.';
        res.json({ reply });
 
    } catch (error) {
        console.error('[Groq API Error]', error.message);
        // [개선 5] 에러 종류에 따라 다른 메시지 반환 - 서버 크래시 방지
        if (error.status === 413 || (error.message && error.message.includes('too large'))) {
            return res.status(400).json({ error: '요청이 너무 길어요. 대화를 새로 시작해주세요.' });
        }
        res.status(500).json({ error: 'AI 서버 오류', detail: error.message });
    }
});
 
// [개선 5] 예상치 못한 에러로 서버 전체가 다운되는 것 방지
process.on('uncaughtException', (err) => {
    console.error('❌ 예상치 못한 에러:', err.message);
});
 
process.on('unhandledRejection', (reason) => {
    console.error('❌ 처리되지 않은 Promise 거부:', reason);
});
 
// ==========================================
// 9. 서버 실행
// ==========================================
app.listen(port, () => {
    console.log(`🐬 돌고래 서버가 http://localhost:${port} 에서 힘차게 헤엄치는 중입니다!`);
    console.log(`   Groq API Key: ${process.env.GROQ_API_KEY ? '✅ 로드됨' : '❌ .env 파일 확인 필요'}`);
    console.log(`   사용 모델: ${CHAT_MODEL}`);
});