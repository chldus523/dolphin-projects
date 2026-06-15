# 🐬 청년정책 돌고래 (dolphin-projects)

가족돌봄청(소)년을 위한 맞춤형 청년정책 안내 플랫폼입니다. 나이, 소득, 가구 형태 등 개인 조건에 맞는 정책을 추천하고, AI 챗봇 '돌고래'가 신청 절차와 필요 서류를 안내합니다.

## 주요 기능

로그인/로그아웃 기능을 통해 사용자별로 맞춤 화면을 제공하며, 홈 화면에서는 사용자에게 맞는 정책 카드와 서류 가이드, 커뮤니티, AI 챗봇 진입점을 모아서 보여줍니다. 정보 탐색 화면에서는 추천 정책 목록과 정책별 서류 준비 체크리스트를 진행률과 함께 확인할 수 있습니다. 커뮤니티 화면에서는 정책 후기와 고민 게시판을 둘러볼 수 있고, 마이페이지에서는 개인 정보를 수정하고 신청 서류함과 찜한 정책을 관리할 수 있습니다.

가장 핵심적인 기능은 AI 챗봇 '돌고래'입니다. 홈 화면의 챗봇 카드를 클릭하면 팝업 형태로 채팅창이 열리고, Groq API와 Qwen3 32B 모델을 활용해 가족돌봄청년에게 맞는 복지 정책을 추천하고 신청 방법과 필요 서류를 안내합니다. 욕설이나 개인정보가 포함된 입력은 AI 호출 전에 차단되며, 복지 상담과 무관한 질문에는 정중하게 본래 주제로 안내합니다.

## 기술 스택

프론트엔드는 순수 HTML, CSS, JavaScript로 구성되어 있으며 별도의 빌드 과정이 필요 없습니다. 백엔드는 Node.js와 Express로 작성되었고, 사용자 데이터는 MySQL에 저장됩니다. AI 챗봇은 Groq API를 통해 Qwen3 32B 모델을 호출합니다.

## 폴더 구조

```
dolphin-projects/
├── backend/
│   ├── server.js          # Express 서버, 로그인 API, 챗봇 API
│   ├── index.html          # 로그인 화면
│   ├── home.html           # 홈 화면 (챗봇 팝업 포함)
│   ├── explore.html         # 정보 탐색 (정책 추천 + 서류 가이드)
│   ├── community.html       # 커뮤니티
│   ├── mypage.html          # 마이페이지
│   ├── style.css            # 전체 공통 스타일
│   ├── package.json         # 의존성 목록
│   └── .env                 # 환경변수 (Git에 포함되지 않음)
├── data/
│   └── policies.json        # 정책 정보 더미 데이터
└── 돌고래sql.sql            # MySQL 데이터베이스 스키마
```

## 실행 방법

### 1. 사전 준비

Node.js와 MySQL이 설치되어 있어야 합니다. Groq API 키는 [console.groq.com](https://console.groq.com)에서 무료로 발급받을 수 있습니다.

### 2. MySQL 데이터베이스 설정

MySQL Workbench 또는 명령줄에서 아래 SQL을 실행해 데이터베이스와 테이블을 생성합니다.

```sql
CREATE DATABASE IF NOT EXISTS dolgorae_db;
USE dolgorae_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userid VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users (userid, password) VALUES ('test', '1234');
```

`server.js`에 설정된 MySQL 접속 정보(`host`, `user`, `password`, `database`)가 본인의 환경과 일치하는지 확인합니다.

### 3. 환경변수 설정

`backend` 폴더 안에 `.env` 파일을 만들고 Groq API 키를 입력합니다.

```
GROQ_API_KEY=발급받은_API_키
PORT=3000
```

### 4. 패키지 설치 및 서버 실행

```bash
cd backend
npm install
node server.js
```

터미널에 아래와 같이 표시되면 정상적으로 실행된 것입니다.

```
🐬 돌고래 서버가 http://localhost:3000 에서 힘차게 헤엄치는 중입니다!
   Groq API Key: ✅ 로드됨
   사용 모델: qwen/qwen3-32b
🐬 MySQL 데이터베이스에 성공적으로 연결되었습니다!
```

5. 접속

브라우저에서 `http://localhost:3000`에 접속하면 로그인 화면이 나타납니다. 위에서 추가한 테스트 계정(아이디 `test`, 비밀번호 `1234`)으로 로그인하면 홈 화면으로 이동합니다.

 챗봇 동작 구조

챗봇은 다음 순서로 동작합니다.

첫째, 사용자가 메시지를 입력하면 서버가 욕설이나 개인정보(주민등록번호, 전화번호, 카드번호 형식) 패턴을 먼저 검사합니다. 해당하는 내용이 있으면 AI를 호출하지 않고 즉시 안내 메시지를 반환합니다.

둘째, 가드레일을 통과한 메시지는 시스템 프롬프트와 함께 Groq API로 전달됩니다. 시스템 프롬프트에는 챗봇의 페르소나, 주요 복지 정책 목록(가족돌봄청년 지원사업, 청년월세 특별지원, 일상돌봄 서비스, 청년도약계좌, 국민취업지원제도), 출력 형식 규칙(마크다운 기호 사용 금지), URL 안내 규칙(실제 존재하는 도메인만 안내) 등이 포함되어 있습니다.

셋째, Qwen3 32B 모델이 생성한 답변이 메신저 대화체 형식으로 사용자에게 전달됩니다.

## 주의사항

`.env` 파일에는 Groq API 키가 포함되어 있으므로 절대 Git에 커밋하지 않아야 합니다. `.gitignore`에 `.env`가 포함되어 있는지 항상 확인하세요.

현재 정책 정보는 시스템 프롬프트에 직접 포함된 형태이며, 향후 LangChain이나 LlamaIndex를 활용한 벡터 검색(RAG) 방식으로 확장할 계획입니다.