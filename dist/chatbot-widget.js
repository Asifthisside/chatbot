/**
 * Chatbot Widget - Standalone Embeddable Script
 * This script creates a chatbot widget that can be embedded in any website
 */

(function() {
  'use strict';

  // Get configuration from global Chatbot_API object
  const config = window.Chatbot_API || {};
  const chatbotId = config.chatbotId;
  const position = config.position || 'right';
  // Use Vercel backend URL or config API URL
  const apiUrl = config.apiUrl || 'https://chatbot-xi-six-89.vercel.app/api';

  if (!chatbotId) {
    console.error('Chatbot Widget Error: chatbotId is required. Please set Chatbot_API.chatbotId');
    return;
  }

  // Widget state
  let chatbot = null;
  let isOpen = false;
  let messages = [];
  let deviceId = localStorage.getItem('chatbot_deviceId') || 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('chatbot_deviceId', deviceId);

  // Fetch chatbot data
  fetch(`${apiUrl}/chatbots/${chatbotId}`)
    .then(res => res.json())
    .then(data => {
      chatbot = data;
      createWidget();
    })
    .catch(err => {
      console.error('Error loading chatbot:', err);
      createWidget(); // Create widget anyway with default config
    });

  function createWidget() {
    // Create widget container
    const widget = document.createElement('div');
    widget.id = 'chatbot-widget';
    widget.style.cssText = `
      position: fixed;
      ${position === 'left' ? 'left: 20px;' : 'right: 20px;'}
      bottom: 20px;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'chatbot-toggle';
    toggleBtn.innerHTML = chatbot?.iconImage 
      ? `<img src="${chatbot.iconImage}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover;" />`
      : `<div style="width: 60px; height: 60px; border-radius: 50%; background: ${chatbot?.primaryColor || '#3B82F6'}; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">${chatbot?.icon || '💬'}</div>`;
    toggleBtn.style.cssText = `
      width: 60px;
      height: 60px;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.2s;
    `;
    toggleBtn.onmouseover = () => toggleBtn.style.transform = 'scale(1.1)';
    toggleBtn.onmouseout = () => toggleBtn.style.transform = 'scale(1)';
    toggleBtn.onclick = toggleWidget;

    // Create chat window
    const chatWindow = document.createElement('div');
    chatWindow.id = 'chatbot-window';
    chatWindow.style.cssText = `
      position: absolute;
      bottom: 80px;
      ${position === 'left' ? 'left: 0;' : 'right: 0;'}
      width: 380px;
      height: 600px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      display: none;
      flex-direction: column;
      overflow: hidden;
    `;

    // Chat header
    const header = document.createElement('div');
    header.style.cssText = `
      background: ${chatbot?.primaryColor || '#3B82F6'};
      color: white;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    const closeBtn = document.createElement('button');
    closeBtn.id = 'chatbot-close';
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = 'background: none; border: none; color: white; font-size: 24px; cursor: pointer;';
    closeBtn.onclick = toggleWidget;
    
    header.innerHTML = `
      <div>
        <div style="font-weight: 600; font-size: 16px;">${chatbot?.name || 'Chatbot'}</div>
        <div style="font-size: 12px; opacity: 0.9;">Online</div>
      </div>
    `;
    header.appendChild(closeBtn);

    // Messages container
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'chatbot-messages';
    messagesContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f9fafb;
    `;

    // Input area
    const inputArea = document.createElement('div');
    inputArea.style.cssText = `
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 8px;
    `;
    const input = document.createElement('input');
    input.id = 'chatbot-input';
    input.type = 'text';
    input.placeholder = 'Type your message...';
    input.style.cssText = `
      flex: 1;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
    `;
    const sendBtn = document.createElement('button');
    sendBtn.innerHTML = 'Send';
    sendBtn.style.cssText = `
      padding: 12px 24px;
      background: ${chatbot?.primaryColor || '#3B82F6'};
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    `;
    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => {
      if (e.key === 'Enter') sendMessage();
    };

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    // Assemble chat window
    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputArea);

    // Assemble widget
    widget.appendChild(toggleBtn);
    widget.appendChild(chatWindow);

    document.body.appendChild(widget);

    // Show welcome message
    if (chatbot?.welcomeMessage) {
      addMessage('bot', chatbot.welcomeMessage);
    }
  }

  function toggleWidget() {
    isOpen = !isOpen;
    const window = document.getElementById('chatbot-window');
    if (window) {
      window.style.display = isOpen ? 'flex' : 'none';
    }
  }

  function addMessage(type, text) {
    messages.push({ type, text, timestamp: new Date() });
    const container = document.getElementById('chatbot-messages');
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      margin-bottom: 12px;
      display: flex;
      ${type === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
    `;

    const messageBubble = document.createElement('div');
    messageBubble.style.cssText = `
      max-width: 75%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      ${type === 'user' 
        ? `background: ${chatbot?.primaryColor || '#3B82F6'}; color: white; border-bottom-right-radius: 4px;`
        : 'background: white; color: #1f2937; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);'
      }
    `;
    messageBubble.textContent = text;

    messageDiv.appendChild(messageBubble);
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
  }

  async function sendMessage() {
    const input = document.getElementById('chatbot-input');
    const text = input?.value?.trim();
    if (!text || !chatbot) return;

    addMessage('user', text);
    input.value = '';

    try {
      const response = await fetch(`${apiUrl}/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chatbotId: chatbot._id,
          text: text,
          type: 'user',
          deviceId: deviceId
        })
      });

      const data = await response.json();

      // Generate bot response
      let botResponse = chatbot.welcomeMessage || 'Thank you for your message!';
      
      if (chatbot.faqs && chatbot.faqs.length > 0) {
        const matchedFAQ = chatbot.faqs.find(faq => 
          text.toLowerCase().includes(faq.question?.toLowerCase() || '')
        );
        if (matchedFAQ && matchedFAQ.answer) {
          botResponse = matchedFAQ.answer;
        }
      }

      setTimeout(() => {
        addMessage('bot', botResponse);
      }, 500);

    } catch (error) {
      console.error('Error sending message:', error);
      addMessage('bot', 'Sorry, there was an error. Please try again.');
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {});
  }
})();

