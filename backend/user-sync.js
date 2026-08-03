/**
 * 사용자 상태 동기화 (즐겨찾기 · 서류체크)
 *
 * 서버(세션 기반 DB)를 원본으로 두고, localStorage는 화면 표시용 캐시로 사용한다.
 * - 페이지 로드 시 pullUserData()로 서버 → localStorage 채움 (기존 읽기 코드 그대로 동작)
 * - 변경 시 pushBookmark()/pushDocCheck()로 localStorage + 서버 동시 갱신
 *
 * 모든 요청은 credentials로 세션 쿠키를 보내 인증한다.
 */

// 서버에서 즐겨찾기·서류체크를 받아 localStorage에 채운다 (로그인 상태에서만)
async function pullUserData() {
    try {
        const [bmRes, dcRes] = await Promise.all([
            fetch('/api/bookmarks', { credentials: 'include' }),
            fetch('/api/doc-checks', { credentials: 'include' }),
        ]);
        if (bmRes.ok) {
            const bookmarks = await bmRes.json();               // policy_id 배열
            localStorage.setItem('bookmarkedPolicies', JSON.stringify(bookmarks));
        }
        if (dcRes.ok) {
            const docChecks = await dcRes.json();                // { "policyId-idx": bool }
            localStorage.setItem('docChecks', JSON.stringify(docChecks));
        }
    } catch (e) {
        // 서버 오류 시 기존 localStorage 캐시를 그대로 사용
        console.warn('[user-sync] 서버 동기화 실패, 로컬 캐시 사용:', e.message);
    }
}

// 즐겨찾기 추가/삭제를 서버에 반영
function pushBookmark(policyId, added) {
    if (added) {
        return fetch('/api/bookmarks', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ policy_id: policyId }),
        }).catch(e => console.warn('[user-sync] 즐겨찾기 저장 실패:', e.message));
    }
    return fetch(`/api/bookmarks/${encodeURIComponent(policyId)}`, {
        method: 'DELETE', credentials: 'include',
    }).catch(e => console.warn('[user-sync] 즐겨찾기 삭제 실패:', e.message));
}

// 서류 체크 상태를 서버에 반영
function pushDocCheck(policyId, docIndex, checked) {
    return fetch('/api/doc-checks', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy_id: policyId, doc_index: docIndex, checked: !!checked }),
    }).catch(e => console.warn('[user-sync] 서류체크 저장 실패:', e.message));
}
