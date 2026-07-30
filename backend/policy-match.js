/**
 * 정책 매칭 공용 모듈
 *
 * 브라우저(<script src="policy-match.js">)와 Node(require) 양쪽에서 사용합니다.
 * 정책 데이터의 텍스트에서 조건을 추출하는 로직을 한곳에서 관리합니다.
 */

var SEOUL_DISTRICTS = [
    '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구',
    '강북구', '도봉구', '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구',
    '구로구', '금천구', '영등포구', '동작구', '관악구', '서초구', '강남구', '송파구', '강동구',
];

/**
 * 특정 자치구 주민만 신청 가능한 정책인지 판별
 * 정책명에 자치구 이름이 들어 있으면 그 자치구 전용으로 본다.
 * @returns {string|null} 자치구명 (전 지역 대상이면 null)
 */
function policyDistrict(policy) {
    var text = (policy['정책명'] || '') + ' ' + (policy['가구수_조건'] || '');
    for (var i = 0; i < SEOUL_DISTRICTS.length; i++) {
        if (text.indexOf(SEOUL_DISTRICTS[i]) !== -1) return SEOUL_DISTRICTS[i];
    }
    return null;
}

/**
 * 사용자의 거주 자치구로 해당 정책을 신청할 수 있는지
 * 자치구 정보가 없거나 전 지역 대상이면 true (확실할 때만 제외한다는 원칙)
 */
function matchesDistrict(policy, userDistrict) {
    var required = policyDistrict(policy);
    if (!required) return true;          // 전 지역 대상
    if (!userDistrict) return true;      // 사용자가 자치구 미입력 → 판단 보류
    return required === userDistrict;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SEOUL_DISTRICTS, policyDistrict, matchesDistrict };
}
