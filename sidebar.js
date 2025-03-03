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
  
  // Configure marked.js options
  marked.setOptions({
    breaks: true,  // Render line breaks as <br>
    gfm: true,     // Enable GitHub Flavored Markdown
    headerIds: false,
    mangle: false
  });
  
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
    
    if (isUser) {
      // For user messages, just display the plain text
      messageElement.textContent = text;
    } else {
      // For AI responses, render markdown
      messageElement.innerHTML = marked.parse(text);
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add syntax highlighting to code blocks
    if (!isUser && messageElement.querySelectorAll('pre code').length > 0) {
      messageElement.querySelectorAll('pre code').forEach(block => {
        block.classList.add('code-block');
      });
    }
  }
  
  async function callOpenAI(apiKey, message) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant. Format your responses using markdown for better readability. Use code blocks with language specifications when providing code.'
            },
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }
      
      const data = await response.json();
      return data.choices[0]?.message?.content || 'No response from API';
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return `Error: ${error.message}`;
    }
  }
  
  function handleSendMessage() {
    const message = chatInput.value.trim();
    if (message) {
      addMessage(message, true);
      chatInput.value = '';
      
      // Show typing indicator
      const typingIndicator = document.createElement('div');
      typingIndicator.className = 'response-message typing-indicator';
      typingIndicator.textContent = 'Typing...';
      chatMessages.appendChild(typingIndicator);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      // Check if we have an API key before proceeding
      chrome.storage.local.get(['openai_api_key'], async function(result) {
        if (result.openai_api_key) {
          try {
            const response = await callOpenAI(result.openai_api_key, message);
            // Remove typing indicator
            chatMessages.removeChild(typingIndicator);
            // Add the API response
            addMessage(response, false);
          } catch (error) {
            // Remove typing indicator
            chatMessages.removeChild(typingIndicator);
            // Show error message
            addMessage(`Error: ${error.message}`, false);
          }
        } else {
          // Remove typing indicator
          chatMessages.removeChild(typingIndicator);
          // Prompt for API key
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