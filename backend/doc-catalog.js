/**
 * 서류 발급 카탈로그
 *
 * 서류명 → 공식 발급 기관/페이지 매핑. 정책마다 반복되는 공통 서류를
 * 한곳에서 관리한다. (브라우저 <script src>와 Node require 양쪽 사용)
 *
 * URL은 정부·공공기관 공식 발급 사이트를 사용한다. (모두 접속 확인됨)
 * 신청서·동의서 등 현장/기관 제출 양식은 발급 링크가 없으므로 카탈로그에 넣지 않는다.
 */

var DOC_CATALOG = [
    { keywords: ['주민등록등본', '주민등록표등본'], issuer: '정부24',                url: 'https://www.gov.kr' },
    { keywords: ['주민등록초본', '초본'],           issuer: '정부24',                url: 'https://www.gov.kr' },
    { keywords: ['가족관계증명서', '기본증명서', '혼인관계증명서'], issuer: '대법원 전자가족관계등록시스템', url: 'https://efamily.scourt.go.kr' },
    { keywords: ['건강보험', '납부확인서', '자격득실'], issuer: '국민건강보험공단',      url: 'https://www.nhis.or.kr' },
    { keywords: ['소득금액증명', '원천징수', '근로소득', '사업소득', '소득확인'], issuer: '국세청 홈택스', url: 'https://www.hometax.go.kr' },
    { keywords: ['장애인등록증', '장애인 증명', '장애인증명'], issuer: '정부24',        url: 'https://www.gov.kr' },
    { keywords: ['한부모가족 증명', '한부모가족증명'], issuer: '정부24',              url: 'https://www.gov.kr' },
    { keywords: ['차상위계층 확인', '차상위계층확인'], issuer: '복지로',              url: 'https://www.bokjiro.go.kr' },
    { keywords: ['수급자증명', '수급자 증명'],       issuer: '복지로',                url: 'https://www.bokjiro.go.kr' },
    { keywords: ['고용보험 가입', '고용보험가입'],   issuer: '고용보험',              url: 'https://www.ei.go.kr' },
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
