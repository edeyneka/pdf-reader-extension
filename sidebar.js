document.addEventListener('DOMContentLoaded', function() {
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const chatMessages = document.getElementById('chat-messages');
  const settingsButton = document.getElementById('settings-button');
  const settingsModal = document.getElementById('settings-modal');
  const closeButton = document.querySelector('.close-button');
  const apiKeyInput = document.getElementById('api-key');
  const saveApiKeyButton = document.getElementById('save-api-key');
  const clearApiKeyButton = document.getElementById('clear-api-key');
  const saveStatus = document.getElementById('save-status');

  // A global conversation array to store system, user, and assistant messages
  let conversation = [
    {
      role: 'system',
      content: 'You are a helpful assistant. Format your responses using markdown for better readability. Use code blocks with language specifications when providing code.'
    }
  ];

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
  
  // Clear API key from storage
  function clearApiKey() {
    chrome.storage.local.remove('openai_api_key', function() {
      apiKeyInput.value = '';
      saveStatus.textContent = 'API key cleared successfully!';
      saveStatus.className = 'save-status success';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 3000);
    });
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
  
  // Only attach event listener if the button exists
  if (clearApiKeyButton) {
    clearApiKeyButton.addEventListener('click', clearApiKey);
  } else {
    console.warn('Clear API Key button not found in DOM');
  }
  
  // Add a message to the chat UI
  function addMessage(text, isUser) {
    const messageElement = document.createElement('div');
    messageElement.className = isUser ? 'user-message' : 'response-message';
    
    if (isUser) {
      // For user messages, just display plain text
      messageElement.textContent = text;
    } else {
      // For AI responses, render markdown
      messageElement.innerHTML = marked.parse(text);
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add syntax highlighting (optional custom styling for code blocks)
    if (!isUser && messageElement.querySelectorAll('pre code').length > 0) {
      messageElement.querySelectorAll('pre code').forEach(block => {
        block.classList.add('code-block');
      });
    }
  }
  
  // Call the OpenAI API with the entire conversation
  async function callOpenAI(apiKey, conversation) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: conversation,
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
  
  // Handle sending a message
  function handleSendMessage() {
    const userMessage = chatInput.value.trim();
    if (!userMessage) return; // don't send empty messages
    
    // Clear the input and show the user's message
    chatInput.value = '';
    addMessage(userMessage, true);

    // Add user message to the conversation array
    conversation.push({ role: 'user', content: userMessage });
    
    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'response-message typing-indicator';
    typingIndicator.textContent = 'Typing...';
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Fetch the API key and call OpenAI
    chrome.storage.local.get(['openai_api_key'], async function(result) {
      const apiKey = result.openai_api_key;
      if (!apiKey) {
        // No API key, prompt the user to add one
        chatMessages.removeChild(typingIndicator);
        addMessage("Please add your OpenAI API key in settings to enable chat functionality.", false);
        settingsModal.style.display = 'block';
        return;
      }

      // We have an API key, call the API with the entire conversation array
      try {
        const aiResponse = await callOpenAI(apiKey, conversation);
        
        // Remove typing indicator
        chatMessages.removeChild(typingIndicator);
        
        // Display the AI response
        addMessage(aiResponse, false);

        // Add the assistant response to conversation
        conversation.push({ role: 'assistant', content: aiResponse });

      } catch (error) {
        chatMessages.removeChild(typingIndicator);
        addMessage(`Error: ${error.message}`, false);
      }
    });
  }
  
  // Send button click
  sendButton.addEventListener('click', handleSendMessage);
  
  // Press Enter to send
  chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });
});
