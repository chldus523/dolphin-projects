/**
 * 설문 배너 시스템 (survey-banner.js)
 * 
 * 사용법:
 * SurveyBanner.show('onboarding', '구글폼링크');
 * SurveyBanner.show('explore', '구글폼링크');
 * SurveyBanner.show('community', '구글폼링크');
 */

const SurveyBanner = (() => {
    const STORAGE_KEY = 'survey_status';
    const HIDE_DURATION = 24 * 60 * 60 * 1000; // 하루

    function getStatus() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
    }
    function setStatus(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function shouldShow(type) {
        const status = getStatus();
        const s = status[type];
        if (!s) return true;
        if (s.hiddenUntil && Date.now() < s.hiddenUntil) return false;
        return true;
    }

    function markCompleted(type) {
        const status = getStatus();
        status[type] = { completed: true };
        setStatus(status);
    }

    function markHidden(type) {
        const status = getStatus();
        status[type] = { ...(status[type] || {}), hiddenUntil: Date.now() + HIDE_DURATION };
        setStatus(status);
    }

    function removeBanner(type) {
        const el = document.getElementById(`survey-banner-${type}`);
        if (el) el.remove();
    }

    function show(type, formUrl) {
        if (!shouldShow(type)) return;
        if (document.getElementById(`survey-banner-${type}`)) return;

        const TITLES = {
            onboarding: '초기 설정 경험을 알려주세요 🐬',
            explore:    '정보 탐색 경험을 알려주세요 🐬',
            community:  '커뮤니티 경험을 알려주세요 🐬',
            chatbot:    '챗봇 답변이 도움이 됐나요?',
        };
        const DESCS = {
            onboarding: '초기 조건 입력 및 서비스 첫인상에 대한 설문입니다. (약 1분)',
            explore:    '맞춤 정책 안내와 정보 탐색 경험에 대한 설문입니다. (약 1분)',
            community:  '커뮤니티 사용 경험에 대한 설문입니다. (약 1분)',
            chatbot:    '챗봇 답변 품질 향상을 위한 설문입니다. (약 30초)',
        };

        const banner = document.createElement('div');
        banner.id = `survey-banner-${type}`;
        banner.style.cssText = `
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%);
            width: min(480px, calc(100vw - 32px));
            background: #fff;
            border: 1.5px solid #bae6fd;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(14,165,233,0.18);
            padding: 1rem 1.2rem;
            z-index: 8000;
            display: flex;
            align-items: center;
            gap: 0.8rem;
            animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1);
            font-family: 'Pretendard', sans-serif;
        `;

        banner.innerHTML = `
            <style>
                @keyframes slideUp {
                    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            </style>
            <div style="font-size:1.6rem;flex-shrink:0;">📋</div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.88rem;font-weight:800;color:#0f172a;margin-bottom:2px;">${TITLES[type]}</div>
                <div style="font-size:0.75rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${DESCS[type]}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.4rem;flex-shrink:0;align-items:flex-end;">
                <button id="survey-btn-go-${type}" style="background:linear-gradient(135deg,#0369a1,#0ea5e9);color:#fff;border:none;border-radius:10px;padding:0.45rem 1rem;font-size:0.8rem;font-weight:700;cursor:pointer;white-space:nowrap;">설문 참여하기</button>
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.7rem;color:#94a3b8;cursor:pointer;">
                        <input type="checkbox" id="survey-hide-${type}" style="accent-color:#0ea5e9;cursor:pointer;">
                        하루 동안 보지 않기
                    </label>
                    <button id="survey-btn-close-${type}" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1rem;line-height:1;padding:2px;">✕</button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);

        // 설문 참여
        document.getElementById(`survey-btn-go-${type}`).addEventListener('click', () => {
            markCompleted(type);
            window.open(formUrl, '_blank');
            removeBanner(type);
        });

        // 닫기
        document.getElementById(`survey-btn-close-${type}`).addEventListener('click', () => {
            const hide = document.getElementById(`survey-hide-${type}`).checked;
            if (hide) markHidden(type);
            removeBanner(type);
        });
    }

    // 챗봇 좋아요/싫어요 (메시지 말풍선 아래 삽입)
    function showChatFeedback(msgEl, formUrl) {
        if (!msgEl || msgEl.querySelector('.chat-feedback')) return;
        const fb = document.createElement('div');
        fb.className = 'chat-feedback';
        fb.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-top:4px;padding-left:32px;';
        fb.innerHTML = `
            <span style="font-size:0.7rem;color:#94a3b8;">도움이 됐나요?</span>
            <button class="fb-btn" data-val="good" style="background:none;border:1px solid #e2e8f0;border-radius:20px;padding:2px 8px;font-size:0.75rem;cursor:pointer;">👍</button>
            <button class="fb-btn" data-val="bad" style="background:none;border:1px solid #e2e8f0;border-radius:20px;padding:2px 8px;font-size:0.75rem;cursor:pointer;">👎</button>
        `;
        msgEl.parentElement.insertAdjacentElement('afterend', fb);
        fb.querySelectorAll('.fb-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                fb.innerHTML = `<span style="font-size:0.7rem;color:#0ea5e9;">감사해요! 더 자세한 의견을 남겨주시면 큰 도움이 돼요 → <a href="${formUrl}" target="_blank" style="color:#0ea5e9;font-weight:700;">설문 참여</a></span>`;
            });
        });
    }

    return { show, showChatFeedback, markCompleted, shouldShow };
})();