/*********************************************************
 * index.js
 * Renders the chat widget in a Shadow DOM at #chat-widget-container
 *********************************************************/
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeChatWidget);
} else {
  initializeChatWidget();
}

async function initializeChatWidget() {
  const container = document.getElementById('chat-widget-container');
  if (!container) {
    console.error('Chat widget container not found');
    return;
  }

  if (container.parentElement !== document.body) {
    document.body.appendChild(container);
  }

  container.style.position = 'relative';
  container.style.zIndex  = '2147483647';

  const botId = container.getAttribute('data-user-id');
  if (!botId) {
    console.error('User ID not found (data-user-id is missing)');
    return;
  }

  const shadowRoot = container.attachShadow({ mode: 'open' });

  if (!document.getElementById('saicf-global-scroll-style')) {
    const globalScrollStyle = document.createElement('style');
    globalScrollStyle.id = 'saicf-global-scroll-style';
    globalScrollStyle.textContent = `
      body.no-scroll,
      html.no-scroll {
        overflow: hidden !important;
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        touch-action: none !important;
        overscroll-behavior: none !important;
      }
    `;
    document.head.appendChild(globalScrollStyle);
  }

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    /**********************************************************
     * Embedded widget.css (now isolated to this Shadow DOM)
     **********************************************************/
    :host, .saicf-chat-window, .saicf-chat-window * {
      font-family: "DM Sans", sans-serif !important;
    }

    :host {
      --widget-size: 80px; /* fallback – will be overwritten by JS */
    }

    .saicf-chat-window p {
      line-height: 1.3 !important;
      font-size: 15px !important;
    }
    .saicf-chat-widget-icon {
      position: fixed;
      bottom: 20px;
      right: 20px;
      color: white;
      border-radius: 50%;
      width: 100px;
      height: 100px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      font-size: 36px;
      z-index: 999998 !important;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
    .pulsing {
      animation: pulse 2s infinite;
    }
    .saicf-chat-title {
      font-size: 15px;
      font-weight: 600;
    }
    .saicf-chat-window {
      position: fixed;
      bottom: 12px;
      right: 12px;
      width: 400px;
      height: 550px;
      background-color: transparent;
      border: none;
      border-radius: 16px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      display: flex !important;
      flex-direction: column;
      z-index: 2147483647 !important;
      opacity: 0;
      transform: translateY(100%);
      transition: opacity 0.5s ease, transform 0.5s ease;
    }
    .saicf-chat-window.show {
      opacity: 1;
      transform: translateY(0);
    }
    .hidden {
      display: none;
    }
    .saicf-chat-header {
      color: white;
      padding: 10px 15px;
      border-radius: 16px 16px 0px 0px;
      display: flex;
      flex-direction: column;
    }
    .saicf-chat-header-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .saicf-logo-message-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .saicf-close-btn {
      background: none;
      border: none;
      color: rgb(218, 43, 43);
      margin: 0;
      padding: 0;
      outline: none;
      cursor: pointer;
    }
    .saicf-close-chat-widget-icon {
      font-size: 20px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .saicf-close-chat-widget-icon:hover {
      transform: scale(1.2);
    }
    .saicf-chat-body {
      flex: 1;
      padding: 8px;
      padding-top: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      background-color: white;
    }
    .saicf-chat-footer {
      display: flex;
      flex-direction: column;
      padding: 10px;
      background-color: white;
      gap: 8px;
    }
    .saicf-powered-by {
      display: flex;
      justify-content: center;
    }
    .saicf-powered-by-text {
      font-size: 10px;
      color: rgb(146, 146, 146);
      cursor: pointer;
      text-decoration: underline;
    }
    .saicf-input-send-container {
      display: flex;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    .saicf-chat-footer input {
      flex: 1 !important;
      padding: 7px !important;
      border: 1px solid #ccc !important;
      border-radius: 8px !important;
      outline: none !important;
      font-size: 16px !important;
    }
    .saicf-chat-footer button {
      display: flex;
      align-items: center;
      margin-left: 6px;
      padding-left: 15px;
      padding-right: 15px;
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: background-color 0.4s ease, transform 0.2s ease;
    }
    .saicf-chat-footer button:hover {
      background-color: #0595d3;
      transform: translateY(-1.5px);
    }
    .saicf-widget-message {
      max-width: 80%;
      margin: 5px 0;
      padding: 5px;
      border-radius: 10px;
      display: inline-block;
    }
    .widget-user-message {
      align-self: flex-end !important;
      color: white !important;
      border-radius: 8px !important;
      padding: 8px !important;
      font-size: 15px !important;
    }
    .widget-bot-message {
      align-self: flex-start !important;
      background-color: #ffffff !important;
      color: rgb(43, 43, 43) !important;
      border-radius: 8px;
      font-size: 15px !important;
    }
    .widget-bot-message strong {
      color: rgb(57, 57, 57);
    }
    .widget-bot-message ul li:not(:last-child) {
      margin-bottom: 6px;
    }
    .widget-user-message > :first-child,
    .widget-bot-message > :first-child {
      margin: 0;
    }
    .widget-user-message > :last-child,
    .widget-bot-message > :last-child {
      margin: 0;
    }
    .saicf-widget-send-icon {
      font-size: 18px;
      font-style: normal;
    }
    .saicf-loading-dots {
      display: flex;
      justify-content: left;
      align-items: center;
      height: 40px;
      margin-top: 10px;
      margin-bottom: 5px;
    }
    .saicf-loading-dots div {
      width: 8px;
      height: 8px;
      margin: 0 4px;
      border-radius: 50%;
      animation: loading 0.6s infinite alternate;
    }
    @keyframes loading {
      to {
        opacity: 0.3;
        transform: translateY(-8px);
      }
    }
    .saicf-loading-dots div:nth-child(2) {
      animation-delay: 0.2s;
    }
    .saicf-loading-dots div:nth-child(3) {
      animation-delay: 0.4s;
    }
    .saicf-chat-widget-icon.align-left {
      left: 25px !important;
      right: auto !important;
    }
    .saicf-chat-widget-icon.elevated {
      bottom: 55px !important;
    }
    .saicf-chat-window.align-left {
      left: 20px !important;
      right: auto !important;
    }
    .saicf-chat-window.elevated {
      bottom: 12px !important;
    }
    .saicf-widget-message table {
      border-collapse: separate;
      border-spacing: 0px;
      margin-top: 15px;
      margin-bottom: 15px;
      width: 100%;
      overflow: auto;
    }
    .saicf-widget-message th, .saicf-widget-message td {
      border: 1px solid rgba(0, 0, 0, 0.08);
      padding: .35rem .50rem;
      text-align: left;
      font-size: 14px;
    }
    .saicf-widget-message th {
      color: #000000;
      background-color: rgba(0, 0, 0, 0.06);
      border-right: 0;
      padding: .5rem .50rem;
      border-bottom: none;
    }
    .saicf-widget-message th:last-child {
      border-right: 1px solid rgba(0, 0, 0, 0.08);
    }
    .saicf-widget-message td {
      border-bottom: 0px solid rgba(0, 0, 0, 0.08);
      border-right: 0px solid rgba(0, 0, 0, 0.08);
    }
    .saicf-widget-message td:last-child {
      border-right: 1px solid rgba(0, 0, 0, 0.08);
    }
    .saicf-widget-message tr:first-child th:first-child {
      border-top-left-radius: 8px;
    }
    .saicf-widget-message tr:first-child th:last-child {
      border-top-right-radius: 8px;
    }
    .saicf-widget-message tr:last-child td:first-child {
      border-bottom-left-radius: 8px;
    }
    .saicf-widget-message tr:last-child td:last-child {
      border-bottom-right-radius: 8px;
    }
    .saicf-widget-message tr:last-child td {
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    /**********************************************************
     * Pop-up message styles
     **********************************************************/
    .saicf-pop-up-container {
      position: fixed;
      right: 20px;
      bottom: calc(35px + var(--widget-size));
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 999999;
    }
    .saicf-pop-up-container.align-left {
      left: 25px !important;
      right: auto !important;
    }
    .saicf-pop-up-message {
      background: #ffffff;
      padding: 12px 16px;
      border-radius: 12px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      font-size: 15px;
      color: #000000;
      max-width: 300px;
      line-height: 1.3;
    }
    .saicf-pop-up-close{
      background:none;
      border:none;
      outline:none;
      font-size:17px;
      font-weight:500;
      color:rgb(163,163,163);
      align-self:flex-end;
      cursor:pointer;
      margin-top:-4px;
      margin-bottom:0;
      transform:scale(1);
      transition:transform 0.5s ease;
    }

    .saicf-pop-up-close:hover{
      transform:scale(1.08);
    }

    .saicf-pop-up-close{
      opacity:0;
      pointer-events:none;
      transition:opacity .3s ease;
    }
    .saicf-pop-up-close.show{
      opacity:1;
      pointer-events:auto;
    }

    .saicf-pop-up-message{
      opacity:0;
      transform:translateY(6px);
      transition:opacity .4s ease, transform .4s ease;
    }
    .saicf-pop-up-message.show{
      opacity:1;
      transform:translateY(0);
    }

    @media (max-width: 768px) {
      .saicf-chat-overlay {
        position: fixed;
        background: rgba(0, 0, 0, 0.2);
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999999;
      }
      .saicf-chat-window {
        position: fixed;
        left: 4%;
        bottom: 1%;
        width: 92%;
        height: 90%;
        border-radius: 16px;
        transition: opacity 0.6s ease, transform 0.6s ease;
      }
      body.no-scroll {
        overflow: hidden;
      }
      .saicf-close-chat-widget-icon {
        font-size: 22px;
      }
      .saicf-chat-title {
        font-size: 16px;
      }
      .widget-user-message {
        font-size: 17px;
      }
      .widget-bot-message {
        font-size: 17px;
      }
      .saicf-chat-widget-icon {
        width: 70px;
        height: 70px;
      }
      .saicf-pop-up-container {
        right: 20px;
        bottom: calc(35px + var(--widget-size));
      }
      .saicf-pop-up-container.align-left {
        left: 20px !important;
        right: auto !important;
      }
    }
  `;
  shadowRoot.appendChild(styleTag);

  const widgetRoot = document.createElement('div');
  widgetRoot.id = 'widget-root';
  shadowRoot.appendChild(widgetRoot);

  if (typeof marked !== 'undefined') {
    marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: false,
    });
  }

  function getBrowserLanguage() {
    return navigator.language || navigator.userLanguage || 'en';
  }
  const browserLanguage = getBrowserLanguage();

  let widgetConfig = {};
  try {
    const response = await fetch(`http://localhost:5000/api/widget_configuration/${botId}`);
    widgetConfig = await response.json();
  } catch (error) {
    console.error('Error fetching widget configuration:', error);
  }
  console.log(widgetConfig.welcome_message)

  const themeColor          = widgetConfig.theme_color             || '#0082ba';
  const hoverColor          = widgetConfig.button_hover_color      || '#0595d3';
  const headerFontColor     = widgetConfig.header_font_color       || '#ffffff';
  const welcomeMessage      = widgetConfig.welcome_message;
  const welcomeMessages     = widgetConfig.welcome_message
            ? Array.isArray(widgetConfig.welcome_message)
              ? widgetConfig.welcome_message
              : [widgetConfig.welcome_message]
            : [""];
  const widgetHeaderText    = widgetConfig.header_text             || 'Chat with us!';
  const widgetBorderRadius  = widgetConfig.widget_border_radius    ?? 50;
  const widgetSize          = widgetConfig.widget_size             ?? 75;
  const logo                = widgetConfig.header_icon_path        || null;
  const icon                = widgetConfig.widget_icon_path        || null;
  const popUpDelaySeconds   = widgetConfig.pop_up_delay_seconds    ?? 2;

  let isPulsing = false;
  if (typeof widgetConfig.pulsing === 'boolean') {
    isPulsing = widgetConfig.pulsing;
  } else if (typeof widgetConfig.pulsing === 'string') {
    isPulsing = widgetConfig.pulsing.toLowerCase() === 'true';
  }

  const horizontalAlignment = widgetConfig.widget_horizontal_alignment || 'right';
  const verticalAlignment   = widgetConfig.widget_vertical_alignment   || 'bottom';

  const chatWidgetIcon = document.createElement('div');
  chatWidgetIcon.className = 'saicf-chat-widget-icon';
  if (isPulsing) {
    chatWidgetIcon.classList.add('pulsing');
  }
  if (!icon) {
    chatWidgetIcon.style.backgroundColor = themeColor;
    chatWidgetIcon.style.paddingBottom = '1px';
  }
  if (widgetBorderRadius != null) {
    chatWidgetIcon.style.borderRadius = `${widgetBorderRadius}%`;
  }
  if (widgetSize != null) {
    chatWidgetIcon.style.height = `${widgetSize}px`;
    chatWidgetIcon.style.width = `${widgetSize}px`;

    container.style.setProperty('--widget-size', `${widgetSize}px`);
  }
  if (icon) {
    chatWidgetIcon.innerHTML = `
      <img
        src="${icon}"
        alt="Widget Icon"
        style="max-width: 100%; max-height: 100%; border-radius: ${widgetBorderRadius}%;">
    `;
  } else {
    chatWidgetIcon.innerHTML = ``;
  }

  const chatOverlay = document.createElement('div');
  chatOverlay.className = 'saicf-chat-overlay hidden';

  const chatWindow = document.createElement('div');
  chatWindow.className = 'saicf-chat-window hidden';

  const logoHTML = logo
    ? `<img src="${logo}" alt="Chat Logo"
         style="height:24px;width:24px;border-radius:50%;object-fit:cover;"/>`
    : '';
  const headerHTML = `
    <div class="saicf-chat-header" style="background-color:${themeColor};">
      <div class="saicf-chat-header-title">
        <div class="saicf-logo-message-container">
          ${logoHTML}
          <span class="saicf-chat-title" style="color:${headerFontColor};">${widgetHeaderText}</span>
        </div>
        <button class="saicf-close-btn saicf-close-chat-widget-icon" style="color:${headerFontColor};">
          X
        </button>
      </div>
    </div>
  `;
  chatWindow.innerHTML = `
    ${headerHTML}
    <div class="saicf-chat-body"></div>
    <div class="saicf-chat-footer">
      <div class="saicf-powered-by">
        <span class="saicf-powered-by-text" onclick="window.open('http://ultimo-bots.com/', '_blank')">
          Powered by Ultimo Bots
        </span>
      </div>
      <div class="saicf-input-send-container">
        <input type="text" class="saicf-chat-input" placeholder="Type your message...">
        <button class="saicf-send-message" style="background-color:${themeColor};">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" style="width: 16px; height: 16px; fill: ${headerFontColor};">
            <path d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0L7 203.6c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 140.3V464c0 17.7 14.3 32 32 32s32-14.3 32-32V140.3l107.6 108.7c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L214.6 41.4z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  const popUpContainer = document.createElement('div');
  popUpContainer.className = 'saicf-pop-up-container hidden';

  const popUpCloseBtn = document.createElement('button');
  popUpCloseBtn.className = 'saicf-pop-up-close';
  popUpCloseBtn.textContent = 'X';
  popUpContainer.appendChild(popUpCloseBtn);

  welcomeMessages.forEach(msg => {
    const msgEl = document.createElement('div');
    msgEl.className = 'saicf-pop-up-message';
    msgEl.textContent = msg;
    popUpContainer.appendChild(msgEl);
  });

  widgetRoot.appendChild(chatWidgetIcon);
  widgetRoot.appendChild(chatOverlay);
  widgetRoot.appendChild(chatWindow);
  widgetRoot.appendChild(popUpContainer);

  if (horizontalAlignment === 'left') {
    chatWidgetIcon.classList.add('align-left');
    chatWindow.classList.add('align-left');
    popUpContainer.classList.add('align-left');
  }
  if (verticalAlignment === 'elevated') {
    chatWidgetIcon.classList.add('elevated');
    chatWindow.classList.add('elevated');
  }

  const dynamicStyleEl = document.createElement('style');
  dynamicStyleEl.textContent = `
    .saicf-chat-footer button:hover {
      background-color: ${hoverColor} !important;
    }
    .widget-user-message {
      background-color: ${themeColor} !important;
    }
    .saicf-loading-dots div {
      background-color: ${themeColor} !important;
    }
  `;
  shadowRoot.appendChild(dynamicStyleEl);

  const closeChatBtn   = chatWindow.querySelector('.saicf-close-btn');
  const chatBody       = chatWindow.querySelector('.saicf-chat-body');
  const chatInput      = chatWindow.querySelector('.saicf-chat-footer input');
  const sendMessageBtn = chatWindow.querySelector('.saicf-send-message');

  let sessionId = generateSessionId();
  let widgetOpenedOnce = false;

  chatWidgetIcon.addEventListener('click', () => {
    chatWindow.classList.remove('hidden');
    forceReflow(chatWindow);
    chatWindow.classList.add('show');
    chatOverlay.classList.remove('hidden');
    if (window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.add('no-scroll');
    }
    if (chatBody.childElementCount === 0) {
      welcomeMessages.forEach(msg => {
        appendMessage(msg, 'bot');
      });
    }
    widgetOpenedOnce = true;
    hidePopUp();
  });

  closeChatBtn.addEventListener('click', () => {
    closeChat();
  });

  sendMessageBtn.addEventListener('click', () => {
    sendMessage();
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  popUpCloseBtn.addEventListener('click', e => {
    e.stopPropagation();
    hidePopUp();
    widgetOpenedOnce = true;
  });

  function showPopUpSequentially() {
    if (widgetOpenedOnce) return;
    popUpContainer.classList.remove('hidden');

    const msgs = popUpContainer.querySelectorAll('.saicf-pop-up-message');
    msgs.forEach((msg, i) => {
      setTimeout(() => {
        msg.classList.add('show');
        if (i === 0) {
          popUpCloseBtn.classList.add('show');
        }
      }, i * 1200);
    });
  }

  function hidePopUp() {
    popUpContainer.classList.add('hidden');
    popUpContainer.querySelectorAll('.saicf-pop-up-message')
                  .forEach(m => m.classList.remove('show'));
    popUpCloseBtn.classList.remove('show');
  }

  setTimeout(showPopUpSequentially, popUpDelaySeconds * 1000);

  function forceReflow(element) {
    void element.offsetHeight;
  }

  function closeChat() {
    chatWindow.classList.remove('show');
    chatOverlay.classList.add('hidden');
    if (window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.remove('no-scroll');
    }
    setTimeout(() => chatWindow.classList.add('hidden'), 300);
  }

  function generateSessionId() {
    const timestamp = new Date().getTime();
    const randomNum = Math.floor(Math.random() * 10000) + 1;
    return `${timestamp}-${randomNum}`;
  }

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    appendMessage(message, 'user');
    chatInput.value = '';
    setLoading(true);

    let currentBotMessage = '';
    const maxRetries = 3;
    let retryCount = 0;

    const attemptConnection = () => {
      return new Promise((resolve, reject) => {
        const url = `https://portal.ultimo-bots.com/api/chatbot_response?user_input=${encodeURIComponent(message)}&session_id=${sessionId}&bot_id=${botId}&language=english`;
        const eventSource = new EventSource(url);

        let isFirstMessage = true;
        let timeoutId;

        eventSource.onmessage = (event) => {
          const chunk = event.data;
          if (chunk !== 'end of response') {
            if (isFirstMessage) {
              setLoading(false);
              isFirstMessage = false;
              clearTimeout(timeoutId);
            }
            const parsedChunk = chunk.replace(/<newline>/g, '\n');
            currentBotMessage += parsedChunk;
            updateBotMessage(currentBotMessage);
            scrollToBottom();
          }
        };

        eventSource.onerror = (error) => {
          if (isFirstMessage) {
            reject(new Error('Failed to get response from server.'));
          }
          eventSource.close();
        };

        eventSource.addEventListener('end', () => {
          updateBotMessage(currentBotMessage);
          eventSource.close();
          setLoading(false);
          scrollToBottom();
          resolve();
        });

        timeoutId = setTimeout(() => {
          if (isFirstMessage) {
            eventSource.close();
            reject(new Error('No response received from server.'));
          }
        }, 8000);
      });
    };

    const retryConnection = async () => {
      while (retryCount < maxRetries) {
        try {
          await attemptConnection();
          return;
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            setLoading(false);
            appendMessage(`Failed to get response after ${maxRetries} attempts.`, 'bot');
            throw error;
          }
        }
      }
    };

    try {
      await retryConnection();
    } catch (error) {
      setLoading(false);
    }
  }

  function updateBotMessage(text) {
    const lastMessage = chatBody.lastElementChild;
    if (lastMessage && lastMessage.classList.contains('widget-bot-message')) {
      if (typeof marked !== 'undefined') {
        lastMessage.innerHTML = marked.parse(text);
      } else {
        lastMessage.textContent = text;
      }
    } else {
      appendMessage(text, 'bot');
    }
  }

  function appendMessage(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `saicf-widget-message widget-${sender}-message`;
    if (typeof marked !== 'undefined') {
      messageElement.innerHTML = marked.parse(text);
    } else {
      messageElement.textContent = text;
    }
    chatBody.appendChild(messageElement);
    scrollToBottom();
  }

  function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function setLoading(isLoading) {
    if (isLoading) {
      const loadingDots = document.createElement('div');
      loadingDots.className = 'saicf-loading-dots';
      loadingDots.innerHTML = '<div></div><div></div><div></div>';
      chatBody.appendChild(loadingDots);
      scrollToBottom();
    } else {
      const loadingDots = chatBody.querySelector('.saicf-loading-dots');
      if (loadingDots) {
        loadingDots.remove();
      }
    }
  }
}
