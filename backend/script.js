// 페이지 로드 시 대화 내역 자동 복원
document.addEventListener('DOMContentLoaded', () => {
    loadChatHistory();
});

// 대화 내역 저장 (메시지 보낼 때/받을 때 자동 호출)
function saveChatHistory() {
    const chatContainer = document.getElementById('widgetChat');
    if (chatContainer) {
        sessionStorage.setItem('dolgorae_chat_html', chatContainer.innerHTML);
    }
}

// 대화 내역 불러오기
function loadChatHistory() {
    const savedHtml = sessionStorage.getItem('dolgorae_chat_html');
    const chatContainer = document.getElementById('widgetChat');
    
    if (chatContainer && savedHtml) {
        chatContainer.innerHTML = savedHtml;
    }
}

// 새 대화 시작 (초기화)
function resetChat() {
    sessionStorage.removeItem('dolgorae_chat_html');
    const chatContainer = document.getElementById('widgetChat');
    if (chatContainer) {
        chatContainer.innerHTML = `
            <div class="chat-message bot">
                <div class="msg-bubble">안녕하세요! 🐬 돌고래 AI입니다. 무엇을 도와드릴까요?</div>
            </div>
        `;
    }
}