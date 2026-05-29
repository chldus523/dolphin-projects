const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const port = 3000;

// ==========================================
// 1. 서버 환경 설정 (미들웨어)
// ==========================================
app.use(cors());
app.use(express.json()); 
app.use(express.static(__dirname)); // 현재 폴더의 HTML, CSS 접근 허용

// ==========================================
// 2. MySQL 데이터베이스 연결 설정
// ==========================================
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      
    password: '1309',  // MySQL 비밀번호
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
// 3. 라우팅 (페이지 및 API 창구)
// ==========================================

// 주소창에 http://localhost:3000 입력 시 index.html(로그인창)을 보여줍니다!
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html'); 
});

// 프론트엔드에서 로그인을 요청했을 때 처리하는 창구 (API)
app.post('/login', (req, res) => {
    const { userid, password } = req.body;

    const query = 'SELECT * FROM users WHERE userid = ? AND password = ?';
    db.query(query, [userid, password], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
        }

        if (results.length > 0) {
            res.json({ success: true, message: '로그인 성공!' });
        } else {
            res.json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다.' });
        }
    });
});

// ==========================================
// 4. 서버 실행
// ==========================================
app.listen(port, () => {
    console.log(`🐬 돌고래 서버가 http://localhost:${port} 에서 힘차게 헤엄치는 중입니다!`);
});