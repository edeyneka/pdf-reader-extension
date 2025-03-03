document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyButton = document.getElementById('save-api-key');

  let pdfContent = '';

  // Load saved API key
  chrome.storage.local.get(['openai_api_key'], (result) => {
    if (result.openai_api_key) {
      apiKeyInput.value = result.openai_api_key;
    }
  });

  // Save API key
  saveApiKeyButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.runtime.sendMessage(
        { action: 'setApiKey', apiKey },
        (response) => {
          if (response.success) {
            alert('API key saved successfully!');
          }
        }
      );
    }
  });

  // Get PDF content from parent window
  window.parent.postMessage({ action: 'getPDFContent' }, '*');
  
  // Listen for PDF content response
  window.addEventListener('message', (event) => {
    if (event.data.action === 'pdfContent') {
      pdfContent = event.data.content;
    }
  });

  function addMessage(text, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function handleUserMessage() {
    const userMessage = userInput.value.trim();
    if (!userMessage) return;

    addMessage(userMessage, true);
    userInput.value = '';
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant-message';
    loadingDiv.textContent = 'Thinking...';
    chatMessages.appendChild(loadingDiv);

    try {
      chrome.runtime.sendMessage(
        {
          action: 'chatWithPDF',
          message: userMessage,
          pdfContent: pdfContent
        },
        (response) => {
          chatMessages.removeChild(loadingDiv);
          
          if (response.success) {
            addMessage(response.response, false);
          } else {
            addMessage('Error: ' + response.error, false);
          }
        }
      );
    } catch (error) {
      chatMessages.removeChild(loadingDiv);
      addMessage('Error: ' + error.message, false);
    }
  }

  sendButton.addEventListener('click', handleUserMessage);
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserMessage();
    }
  });
}); 