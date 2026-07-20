/**
 * 기준 중위소득 계산 공용 모듈
 *
 * 브라우저(<script src="median-income.js">)와 Node(require) 양쪽에서 사용합니다.
 * 값이 바뀌면 이 파일 하나만 수정하면 전체에 반영됩니다.
 *
 * 출처: 보건복지부 「2026년도 기준 중위소득 6.51% 역대 최대로 인상」 보도자료
 *       https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&act=view&list_no=1487098
 */

// 2026년도 기준 중위소득 (가구원 수별 월 금액, 원)
var MEDIAN_INCOME_YEAR = 2026;
var MEDIAN_INCOME = {
    1: 2564238,
    2: 4199292,
    3: 5359036,
    4: 6494738,
    5: 7556719,
    6: 8555952,
};

// 7인 이상은 1인 증가할 때마다 6인과 5인의 차액을 더함 (보건복지부 고시 방식)
function medianIncomeOf(familySize) {
    var n = parseInt(familySize, 10);
    if (!Number.isFinite(n) || n < 1) return null;
    if (MEDIAN_INCOME[n]) return MEDIAN_INCOME[n];
    var step = MEDIAN_INCOME[6] - MEDIAN_INCOME[5];
    return MEDIAN_INCOME[6] + step * (n - 6);
}

/**
 * 월 소득(원)과 가구원 수로 기준 중위소득 대비 비율(%)을 계산
 * @returns {number|null} 예: 78 (= 중위소득의 78%)
 */
function calcIncomePercent(monthlyIncomeWon, familySize) {
    var base = medianIncomeOf(familySize);
    var income = Number(monthlyIncomeWon);
    if (!base || !Number.isFinite(income) || income < 0) return null;
    return Math.round((income / base) * 100);
}

/** 화면 표시용 설명 문구 */
function incomePercentLabel(pct) {
    if (pct === null || pct === undefined) return '';
    return '기준 중위소득의 약 ' + pct + '%';
}

// Node에서 require 가능하도록 (브라우저에서는 무시됨)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MEDIAN_INCOME, MEDIAN_INCOME_YEAR, medianIncomeOf, calcIncomePercent, incomePercentLabel };
}
