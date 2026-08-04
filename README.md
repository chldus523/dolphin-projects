# 🐬 청년정책 돌고래 (dolphin-projects)

가족돌봄청년을 위한 맞춤형 청년정책 안내 플랫폼입니다. 나이, 소득, 거주 지역, 취업 상태 등 개인 조건에 맞는 정책을 추천하고, AI 챗봇 '돌고래'가 신청 절차와 필요 서류를 안내합니다.

---

## 주요 기능

### 🔍 정보 탐색
- 키워드 칩(주거·취업·자산형성·돌봄·금융) 선택으로 원하는 정책 카테고리 필터링
- 나이·거주 지역·소득 수준 조건 설정 → 조건에 맞는 정책 자동 추천
- 소득·지역·나이 기준 미달 정책은 **탈락 정책** 섹션에 탈락 이유와 함께 표시
- 정책 카드에서 ⭐ 찜하기 → 오른쪽 **서류 준비 가이드** 사이드바에 해당 정책 서류 자동 표시 (캐러셀)
- 서류 체크 상태는 localStorage에 저장되어 새로고침 후에도 유지, 마이페이지와 동기화

### 👤 마이페이지
- 나이·거주 지역·소득 구간·취업 상태·가구 형태·돌봄 대상자 입력 → 저장 시 정보 탐색 페이지에 자동 반영
- **찜한 정책**: 정보 탐색에서 찜한 정책의 필요 서류 체크리스트 + 신청 페이지 링크
- **스크랩 목록**: 커뮤니티에서 스크랩한 글 목록 (본문 미리보기, 카테고리 배지, 커뮤니티 바로가기)

### 💬 커뮤니티
- MySQL 기반 실제 게시글 저장/조회
- 카테고리 필터 (고민 게시판·정책 후기·합격/탈락 사례·정보 교류)
- 키워드 검색, 좋아요, 스크랩 기능
- 글쓰기 모달로 직접 게시글 작성 가능
- 스크랩 목록에서 클릭 시 해당 글로 자동 스크롤 + 하이라이트

### 🤖 AI 챗봇 '돌고래'
- 홈 화면 챗봇 카드 클릭 → 팝업 채팅창
- Groq API + Qwen3 32B 모델로 가족돌봄청년 맞춤 복지 안내
- 1단계 입력 가드레일: 욕설·개인정보(주민등록번호·전화번호·카드번호) 패턴 차단
- 복지 상담과 무관한 질문은 본래 주제로 안내

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | HTML, CSS, JavaScript (빌드 불필요) |
| 백엔드 | Node.js, Express |
| 데이터베이스 | MySQL (`dolgorae_db`) |
| AI | Groq API, Qwen3-32B 모델 |
| 데이터 저장 | localStorage (프로필·찜·스크랩·서류 체크 상태) |

---

## 폴더 구조

```
dolphin-projects/
├── backend/
│   ├── server.js          # Express 서버 (로그인·커뮤니티·챗봇 API)
│   ├── index.html         # 로그인 화면
│   ├── home.html          # 홈 화면 (챗봇 팝업 포함)
│   ├── explore.html       # 정보 탐색 (정책 추천 + 서류 준비 가이드)
│   ├── community.html     # 커뮤니티 (MySQL 연동)
│   ├── mypage.html        # 마이페이지 (찜한 정책·스크랩 목록)
│   ├── style.css          # 전체 공통 스타일
│   ├── data/
│   │   └── policies.json  # 정책 정보 (10개, 조건·서류 포함)
│   ├── package.json       # 의존성 목록
│   └── .env               # 환경변수 (Git 미포함)
└── 돌고래sql.sql           # MySQL 데이터베이스 스키마
```

---

## 실행 방법

### 1. 사전 준비
Node.js와 MySQL이 설치되어 있어야 합니다. Groq API 키는 [console.groq.com](https://console.groq.com)에서 무료로 발급받을 수 있습니다.

### 2. MySQL 데이터베이스 설정

MySQL Workbench 또는 명령줄에서 아래 SQL을 실행합니다.

```sql
CREATE DATABASE IF NOT EXISTS dolgorae_db;
USE dolgorae_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    likes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    userid VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 사용자 상태를 계정(DB)에 저장 (프로필·즐겨찾기·서류체크)
CREATE TABLE IF NOT EXISTS user_profiles (
    userid VARCHAR(100) PRIMARY KEY,
    age INT, region VARCHAR(20), family_size INT,
    income_man INT, income_pct INT, income VARCHAR(10),
    care_infant TINYINT DEFAULT 0, care_elderly TINYINT DEFAULT 0, care_disabled TINYINT DEFAULT 0,
    employment VARCHAR(20), household VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS policy_bookmarks (
    userid VARCHAR(100) NOT NULL,
    policy_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_policy (userid, policy_id)
);

CREATE TABLE IF NOT EXISTS document_checks (
    userid VARCHAR(100) NOT NULL,
    policy_id VARCHAR(50) NOT NULL,
    doc_index INT NOT NULL,
    checked TINYINT DEFAULT 0,
    UNIQUE KEY uq_user_doc (userid, policy_id, doc_index)
);

INSERT INTO users (userid, password) VALUES ('test', '1234');
```

### 3. 환경변수 설정

`backend` 폴더 안에 `.env` 파일을 생성합니다.

```
GROQ_API_KEY=발급받은_API_키
```

### 4. 패키지 설치 및 서버 실행

```bash
cd backend
npm install
node server.js
```

정상 실행 시 터미널에 아래와 같이 표시됩니다.

```
🐬 돌고래 서버가 http://localhost:3000 에서 힘차게 헤엄치는 중입니다!
   Groq API Key: ✅ 로드됨
   사용 모델: qwen/qwen3-32b
🐬 MySQL 데이터베이스에 성공적으로 연결되었습니다!
```

### 5. 접속

브라우저에서 `http://localhost:3000` 접속 → 로그인 화면에서 `test` / `1234` 로 로그인

---

## 챗봇 동작 구조

```
사용자 입력
  → 1단계: 입력 가드레일 (욕설·개인정보 필터)
      → 차단 시: 안내 메시지 반환
      → 통과 시: Groq API 호출 (Qwen3-32B + 시스템 프롬프트)
          → 최종 답변 반환
```

향후 LangChain 또는 LlamaIndex 기반 RAG(벡터 검색) 방식으로 확장 예정입니다.

---

## 주의사항

- `.env` 파일에는 Groq API 키가 포함되어 있으므로 절대 Git에 커밋하지 않아야 합니다.
- HTML 파일을 직접 열면 서버 연동이 되지 않습니다. 반드시 `node server.js` 실행 후 `localhost:3000`으로 접속해야 합니다.
