document.addEventListener('DOMContentLoaded', function() {
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const chatMessages = document.getElementById('chat-messages');
  const settingsButton = document.getElementById('settings-button');
  const settingsModal = document.getElementById('settings-modal');
  const closeButton = document.querySelector('.close-button');
  const apiKeyInput = document.getElementById('api-key');
  const saveApiKeyButton = document.getElementById('save-api-key');
  const saveStatus = document.getElementById('save-status');
  
  // Load the API key if it exists
  function loadApiKey() {
    chrome.storage.local.get(['openai_api_key'], function(result) {
      if (result.openai_api_key) {
        apiKeyInput.value = result.openai_api_key;
      }
    });
  }
  
  // Save API key to storage
  function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.local.set({ 'openai_api_key': apiKey }, function() {
        saveStatus.textContent = 'API key saved successfully!';
        saveStatus.className = 'save-status success';
        setTimeout(() => {
          saveStatus.textContent = '';
        }, 3000);
      });
    } else {
      saveStatus.textContent = 'Please enter a valid API key.';
      saveStatus.className = 'save-status error';
    }
  }
  
  // Settings modal controls
  settingsButton.addEventListener('click', function() {
    loadApiKey(); // Load the API key when opening settings
    settingsModal.style.display = 'block';
  });
  
  closeButton.addEventListener('click', function() {
    settingsModal.style.display = 'none';
  });
  
  window.addEventListener('click', function(event) {
    if (event.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });
  
  saveApiKeyButton.addEventListener('click', saveApiKey);
  
  // Chat functionality
  function addMessage(text, isUser) {
    const messageElement = document.createElement('div');
    messageElement.className = isUser ? 'user-message' : 'response-message';
    messageElement.textContent = text;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function handleSendMessage() {
    const message = chatInput.value.trim();
    if (message) {
      addMessage(message, true);
      chatInput.value = '';
      
      // Check if we have an API key before proceeding
      chrome.storage.local.get(['openai_api_key'], function(result) {
        if (result.openai_api_key) {
          // For now, just respond with "Hey Kate"
          // Later, this is where you would make API calls to OpenAI
          setTimeout(() => {
            addMessage("Hey Kate", false);
          }, 500);
        } else {
          addMessage("Please add your OpenAI API key in settings to enable chat functionality.", false);
          settingsModal.style.display = 'block';
        }
      });
    }
  }
  
  sendButton.addEventListener('click', handleSendMessage);
  
  chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });
}); 