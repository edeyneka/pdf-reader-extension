document.addEventListener('DOMContentLoaded', function() {
  const chatInput = document.getElementById('chat-input');
  const sendButton = document.getElementById('send-button');
  const chatMessages = document.getElementById('chat-messages');
  const settingsButton = document.getElementById('settings-button');
  const clearChatButton = document.getElementById('clear-chat-button');
  const settingsModal = document.getElementById('settings-modal');
  const closeButton = document.querySelector('.close-button');
  const apiKeyInput = document.getElementById('api-key');
  const saveApiKeyButton = document.getElementById('save-api-key');
  const clearApiKeyButton = document.getElementById('clear-api-key');
  const saveStatus = document.getElementById('save-status');
  const pdfButton = document.getElementById('pdf-button');

  // Add new variables for PDF handling
  let isPdfContext = false;
  let pdfUrl = '';
  let pdfContent = '';
  const pdfIndicator = document.createElement('div');
  pdfIndicator.className = 'pdf-indicator';
  pdfIndicator.style.display = 'none';
  document.querySelector('.toolbar').appendChild(pdfIndicator);

  // A global conversation array to store system, user, and assistant messages
  let conversation = [
    {
      role: 'system',
      content: 'You are a helpful assistant. Format your responses using markdown for better readability. Use code blocks with language specifications when providing code.'
    }
  ];

  // Add this variable at the top with other state variables
  let pdfBase64 = null;

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
      // Prepare messages
      let messages = conversation.map(msg => {
        // For standard text messages
        if (typeof msg.content === 'string') {
          return msg;
        }
        // For array content (shouldn't happen in our current setup)
        return msg;
      });
      
      // Prepare request body
      let requestBody = {
        model: 'gpt-4o',
        max_tokens: 1000
      };
      
      // If we have a PDF and this is the first user question after PDF is loaded
      if (pdfBase64 && messages.length === 2 && messages[1].role === 'user') {
        // Format with document in content array
        requestBody.messages = [
          messages[0], // System message
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64
                }
              },
              {
                type: 'text',
                text: messages[1].content
              }
            ]
          }
        ];
        
        // Clear the PDF data after using it once to avoid sending it multiple times
        pdfBase64 = null;
      } else {
        // Standard message format
        requestBody.messages = messages;
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
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

  // Listen for messages from background.js about PDFs
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "pdf_detected") {
      isPdfContext = true;
      pdfUrl = request.url;
      updatePdfIndicator();
    } else if (request.action === "pdf_content" && request.text) {
      pdfContent = request.text;
      
      // Clear existing conversation and start a new one with PDF context
      clearChat();
      
      // Add PDF context to the conversation
      const truncatedContent = pdfContent.length > 3000 ? 
        pdfContent.substring(0, 3000) + "... [content truncated due to length]" : 
        pdfContent;
        
      conversation = [
        {
          role: 'system',
          content: `You are a helpful assistant. You are analyzing a PDF document. 
Format your responses using markdown for better readability.
Here is the content of the PDF:

${truncatedContent}

When answering questions, focus on information from this PDF. If the question cannot be answered using the PDF content, politely explain that the information is not in the document.`
        }
      ];
      
      // Add indicator message in the chat
      addMessage(`PDF loaded: ${pdfUrl.split('/').pop()}. You can now ask questions about this document.`, false);
      updatePdfIndicator();
    } else if (request.action === "check_for_pdf") {
      // Get the active tab and check if it's a PDF
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs[0]) {
          const activeTab = tabs[0];
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            function: function() {
              // Various ways to detect a PDF
              const isPdf = document.querySelector('embed[type="application/pdf"]') !== null ||
                            document.querySelector('object[type="application/pdf"]') !== null ||
                            document.querySelector('.textLayer') !== null ||
                            window.location.href.toLowerCase().endsWith('.pdf');
                            
              if (isPdf) {
                let pdfText = "";
                const textLayers = document.querySelectorAll('.textLayer div');
                if (textLayers.length > 0) {
                  textLayers.forEach(el => {
                    pdfText += el.textContent + " ";
                  });
                } else {
                  pdfText = document.body.innerText;
                }
                
                chrome.runtime.sendMessage({
                  action: "pdf_content",
                  text: pdfText || "PDF detected but content extraction was limited.",
                  url: window.location.href
                });
              } else {
                chrome.runtime.sendMessage({
                  action: "not_pdf"
                });
              }
            }
          }).catch(err => {
            console.error("Error executing script:", err);
          });
        }
      });
    } else if (request.action === "not_pdf") {
      addMessage("No PDF detected on the current page.", false);
    } else if (request.action === "pdf_base64") {
      pdfBase64 = request.base64Data;
      pdfUrl = request.url;
      isPdfContext = true;
      
      // Update the conversation with system prompt for PDF
      conversation = [
        {
          role: 'system',
          content: 'You are a helpful assistant. You will be analyzing a PDF document. Format your responses using markdown for better readability. When answering questions, focus on information from the provided PDF.'
        }
      ];
      
      // Show success message
      addMessage(`PDF successfully loaded: ${pdfUrl.split('/').pop()}. You can now ask questions about this document.`, false);
      updatePdfIndicator();
    } else if (request.action === "pdf_error") {
      addMessage(`Error loading PDF: ${request.error}`, false);
    }
  });
  
  // Update the PDF indicator in the UI
  function updatePdfIndicator() {
    if (isPdfContext) {
      // Make indicator more prominent
      pdfIndicator.textContent = `📄 PDF Active: ${pdfUrl.split('/').pop()}`;
      pdfIndicator.style.display = 'block';
      
      // Add a message to the chat if not already added
      if (!document.querySelector('.pdf-loaded-message')) {
        const messageElement = document.createElement('div');
        messageElement.className = 'response-message pdf-loaded-message';
        messageElement.innerHTML = `<strong>PDF loaded:</strong> ${pdfUrl.split('/').pop()}<br>The AI will now answer questions based on this document.`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    } else {
      pdfIndicator.style.display = 'none';
    }
  }

  // Clear chat function - update to also clear PDF context
  function clearChat() {
    // Clear the UI
    chatMessages.innerHTML = '';
    
    // Reset PDF context if it was active
    if (isPdfContext) {
      // Ask user if they want to keep PDF context
      if (confirm("Do you want to clear the PDF context as well?")) {
        isPdfContext = false;
        pdfUrl = '';
        pdfContent = '';
        updatePdfIndicator();
        
        // Reset to standard conversation
        conversation = [
          {
            role: 'system',
            content: 'You are a helpful assistant. Format your responses using markdown for better readability. Use code blocks with language specifications when providing code.'
          }
        ];
      } else {
        // Keep PDF context but clear messages
        // The conversation array already has the PDF context in the system message
      }
    } else {
      // Reset to standard conversation
      conversation = [
        {
          role: 'system',
          content: 'You are a helpful assistant. Format your responses using markdown for better readability. Use code blocks with language specifications when providing code.'
        }
      ];
    }
  }

  // Add event listener for the clear chat button
  clearChatButton.addEventListener('click', clearChat);

  // Add event listener for the PDF button
  pdfButton.addEventListener('click', function() {
    // Show loading message
    addMessage("Fetching PDF document...", false);
    
    // Get current tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs[0]) {
        const pdfUrl = tabs[0].url;
        
        // Check if it's a PDF URL
        if (pdfUrl.toLowerCase().includes('.pdf') || 
            pdfUrl.toLowerCase().includes('arxiv.org/pdf')) {
          
          // Fetch the PDF binary data
          chrome.runtime.sendMessage({ 
            action: "fetch_pdf", 
            url: pdfUrl 
          });
        } else {
          addMessage("Current page does not appear to be a PDF. Please navigate to a PDF document.", false);
        }
      }
    });
  });
});
