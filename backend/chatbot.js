// =============================================
//  돌고래 챗봇 위젯 공통 JS (chatbot.js)
//  home.html, explore.html, community.html, mypage.html 공용
// =============================================

(function () {
    const widget     = document.getElementById('chatbotWidget');
    const widgetChat  = document.getElementById('widgetChat');
    const widgetInput = document.getElementById('widgetInput');
    const widgetSend  = document.getElementById('widgetSend');
    const fabTooltip  = document.getElementById('fabTooltip');
    const fabBadge    = document.getElementById('fabBadge');

    let chatHistory = JSON.parse(sessionStorage.getItem('dolgorae_chatHistory') || '[]');
    let initialized = false;
    let isOpen = false;

    // 저장된 대화가 있으면 UI 복원
    function loadChatHistory() {
        if (chatHistory.length > 0) {
            chatHistory.forEach(m => {
                const role = m.role === 'assistant' ? 'bot' : 'user';
                renderMsg(role, m.content);
            });
            document.getElementById('widgetChips').style.display = 'none';
            initialized = true;
        }
    }

    // sessionStorage에 대화 저장
    function saveChatHistory() {
        sessionStorage.setItem('dolgorae_chatHistory', JSON.stringify(chatHistory));
    }

    // 페이지 로드 시 이전 대화 복원
    document.addEventListener('DOMContentLoaded', loadChatHistory);
    setTimeout(() => fabTooltip.classList.add('hidden'), 3000);

    function getProfile() {
        const p = JSON.parse(localStorage.getItem('userProfile') || '{}');
        return (p.age && p.income) ? p : null;
    }
    function profileSummary() {
        const p = getProfile();
        if (!p) return '';
        const parts = [`만 ${p.age}세`];
        if (p.region) parts.push(p.region);
        if (p.household) parts.push(p.household);
        return parts.join(' · ');
    }

    window.openWidget = function () {
        widget.classList.add('open'); isOpen = true;
        fabBadge.style.display = 'none'; fabTooltip.classList.add('hidden');
        if (!initialized) {
            const welcome = getProfile()
                ? `안녕하세요! 가족돌봄청년을 위한 복지 안내 챗봇 돌고래예요 🐬\n\n마이페이지에 저장하신 정보(${profileSummary()})를 참고해서 안내해 드릴게요. 궁금한 점을 편하게 물어봐 주세요 😊`
                : '안녕하세요! 가족돌봄청년을 위한 복지 안내 챗봇 돌고래예요 🐬\n\n나이, 가구 형태, 소득 수준을 알려주시면 맞춤 지원 정책을 바로 찾아드릴게요. 편하게 질문해 주세요 😊';
            addMsg('bot', welcome);
            initialized = true;
        }
        setTimeout(() => widgetInput.focus(), 200);
    };

    window.closeWidget = function () {
        widget.classList.remove('open'); isOpen = false;
    };

    window.resetChat = function () {
        chatHistory = [];
        saveChatHistory();
        widgetChat.innerHTML = '';
        initialized = false;
        document.getElementById('widgetChips').style.display = 'flex';
        addMsg('bot', '안녕하세요! 가족돌봄청년을 위한 복지 안내 챗봇 돌고래예요 🐬\n\n나이, 가구 형태, 소득 수준을 알려주시면 맞춤 지원 정책을 바로 찾아드릴게요. 편하게 질문해 주세요 😊');
        initialized = true;
    };

    window.toggleWidget = function () {
        if (isOpen) closeWidget(); else openWidget();
    };

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isOpen) closeWidget();
    });

    window.autoResize = function (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 80) + 'px';
    };

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function renderMsg(role, text) {
        const wrap = document.createElement('div');
        wrap.className = `msg ${role}`;
        if (role === 'bot') {
            const av = document.createElement('div');
            av.className = 'msg-av'; av.textContent = '🐬';
            wrap.appendChild(av);
        }
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = escapeHtml(text)
            .replace(/^#{1,6}\s*/gm, '')
            .replace(/^[-*_]{3,}$/gm, '')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" style="color:#0ea5e9;text-decoration:underline;">$1</a>')
            .replace(/\n/g, '<br>');
        wrap.appendChild(bubble);
        widgetChat.appendChild(wrap);
        widgetChat.scrollTop = widgetChat.scrollHeight;
        // 봇 답변 후 피드백 버튼
        if (role === 'bot' && typeof SurveyBanner !== 'undefined') {
            setTimeout(() => {
                SurveyBanner.showChatFeedback(bubble, 'https://forms.gle/nXgSB9fxkDQmM3mY8');
            }, 500);
        }
    }

    function addMsg(role, text) {
        renderMsg(role, text);
        chatHistory.push({ role: role === 'bot' ? 'assistant' : 'user', content: text });
        saveChatHistory();
    }

    function showTyping() {
        const wrap = document.createElement('div');
        wrap.className = 'typing-wrap'; wrap.id = 'typingEl';
        const av = document.createElement('div');
        av.className = 'msg-av'; av.textContent = '🐬';
        const dots = document.createElement('div');
        dots.className = 'typing-dots';
        dots.innerHTML = '<span></span><span></span><span></span>';
        wrap.appendChild(av); wrap.appendChild(dots);
        widgetChat.appendChild(wrap);
        widgetChat.scrollTop = widgetChat.scrollHeight;
    }

    function removeTyping() {
        const el = document.getElementById('typingEl');
        if (el) el.remove();
    }

    window.sendChip = function (el) {
        widgetInput.value = el.textContent.replace(/^\S+\s/, '').trim();
        sendMessage();
    };

    widgetInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    window.sendMessage = async function () {
        const text = widgetInput.value.trim();
        if (!text) return;
        addMsg('user', text);
        widgetInput.value = ''; widgetInput.style.height = 'auto';
        widgetSend.disabled = true;
        document.getElementById('widgetChips').style.display = 'none';
        showTyping();
        try {
            const res = await fetch('https://dolphin-projects-production.up.railway.app/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ messages: chatHistory.slice(-20), profile: getProfile() })
            });
            const data = await res.json();
            removeTyping();
            const reply = data.reply || '죄송해요, 잠시 오류가 발생했어요. 다시 시도해 주세요.';
            addMsg('bot', reply);
            if (!isOpen) fabBadge.style.display = 'flex';
        } catch (err) {
            removeTyping();
            addMsg('bot', '⚠️ 서버에 연결할 수 없어요. node server.js 가 실행 중인지 확인해 주세요.');
            console.error(err);
        } finally {
            widgetSend.disabled = false;
            widgetInput.focus();
        }
    };
})();