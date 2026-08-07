/**
 * 서류 발급 카탈로그
 *
 * 서류명 → 공식 발급 기관/페이지 매핑. 정책마다 반복되는 공통 서류를
 * 한곳에서 관리한다. (브라우저 <script src>와 Node require 양쪽 사용)
 *
 * URL은 정부·공공기관 공식 발급 사이트를 사용한다.
 * 신청서·동의서·고지서 등 현장/기관 제출 양식은 온라인 발급 링크가
 * 없으므로 카탈로그에 넣지 않는다.
 */
var DOC_CATALOG = [
    { keywords: ['주민등록등본', '주민등록표등본', '주민등록초본', '초본'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000015&tp_seq=01' },

    { keywords: ['가족관계증명서', '기본증명서', '혼인관계증명서'],
      issuer: '대법원 전자가족관계등록시스템',
      url: 'https://efamily.scourt.go.kr/pt/PtFrrpApplrInfoInqW.do?menuFg=02&authFg=&agreeNext=undefined&errorCode=&firstAuth=N' },

    { keywords: ['건강보험자격득실', '자격득실'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000022&tp_seq=01' },

    { keywords: ['건강보험료 납부확인', '납부확인서'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000023&tp_seq=01' },

    { keywords: ['소득금액증명', '원천징수', '근로소득', '사업소득', '소득확인'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000021&tp_seq=01' },

    { keywords: ['지방세 납세증명', '지방세납세'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000071&tp_seq=01' },

    { keywords: ['국세 납세증명', '국세납세'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000024&tp_seq=01' },

    { keywords: ['고용보험 피보험자격', '고용보험 가입', '고용보험가입'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=14900000122&tp_seq=01' },

    { keywords: ['재학증명', '졸업증명', '휴학증명'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13400000018&tp_seq=01' },

    { keywords: ['건축물대장'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=15000000098&tp_seq=01' },

    { keywords: ['부동산 등기부등본', '등기부등본'],
      issuer: '인터넷등기소',
      url: 'https://www.iros.go.kr/index.jsp' },

    { keywords: ['병적증명서'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13000000016&tp_seq=01' },

    { keywords: ['국민기초생활수급자', '수급자증명', '수급자 증명'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=14600000328&tp_seq=01' },

    { keywords: ['차상위계층 확인', '차상위계층확인'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=14600000350&tp_seq=01' },

    // 장애인등록증·복지카드는 주민센터 방문 신청 — 정부24 안내 페이지로 연결
    { keywords: ['장애인등록증', '장애인 증명', '장애인증명', '복지카드'],
      issuer: '정부24 안내',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=14600000110&tp_seq=01' },

    { keywords: ['한부모가족 증명', '한부모가족증명'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=14600000305&tp_seq=01' },

    { keywords: ['사업자등록증명'],
      issuer: '정부24',
      url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12100000016&tp_seq=01' },
];

/**
 * 서류명으로 발급처 조회 (부분 일치)
 * @returns {{issuer:string, url:string}|null} 온라인 발급처가 없으면 null
 */
function docIssue(docName) {
    var name = String(docName || '');
    for (var i = 0; i < DOC_CATALOG.length; i++) {
        var kws = DOC_CATALOG[i].keywords;
        for (var j = 0; j < kws.length; j++) {
            if (name.indexOf(kws[j]) !== -1) {
                return { issuer: DOC_CATALOG[i].issuer, url: DOC_CATALOG[i].url };
            }
        }
    }
    return null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DOC_CATALOG, docIssue };
}