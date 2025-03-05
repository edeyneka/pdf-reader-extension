document.addEventListener('DOMContentLoaded', function() {
  // Establish connection with background script
  const port = chrome.runtime.connect({name: "sidebar"});
  
  // Remove the first listener and keep only the one in checkIfPdfPage
  port.onMessage.addListener(function(message) {
    if (message.action === "pdf_content_for_sidebar") {
      // Just update the PDF content without triggering summary
      conversation.push({
        role: 'system',
        content: 'Here is the PDF content to provide context for user questions. Use this content to answer questions:\n\n' + message.text
      });
    }
  });

  // Add this debug check
  if (typeof katex === 'undefined') {
    console.error('KaTeX is not loaded!');
  } else {
    console.log('KaTeX loaded successfully');
  }

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

  // A global conversation array to store system, user, and assistant messages
  let conversation = [
    {
      role: 'system',
      content: 'You are a helpful assistant. Format your responses using markdown for better readability. Use code blocks with language specifications when providing code.'
    }
  ];

  // Add this near the top with other variable declarations
  let isPdfPage = false;
  let pdfContent = '';

  // Move the function definition before its usage
  async function isPdfDocument() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      // Check if URL ends with .pdf or contains /pdf/
      return tab.url.toLowerCase().endsWith('.pdf') || 
             tab.url.toLowerCase().includes('/pdf/') ||
             tab.url.startsWith('chrome://pdf-viewer/') ||
             tab.url.startsWith('chrome-extension://') && tab.url.includes('pdf');
    } catch (error) {
      console.error('Error checking PDF:', error);
      return false;
    }
  }

  async function checkIfPdfPage() {
    try {
      isPdfPage = await isPdfDocument();
      if (isPdfPage) {
        const messageListener = (message) => {
          if (message.action === "pdf_content_for_sidebar") {
            pdfContent = message.text;
            // Add PDF content to conversation
            conversation.push({
              role: 'system',
              content: 'Here is the PDF content to provide context for user questions. Use this content to answer questions:\n\n' + pdfContent
            });
            
            // Remove the listener
            chrome.runtime.onMessage.removeListener(messageListener);
            
            // Automatically request a summary
            conversation.push({ 
              role: 'user', 
              content: 'Analyze and explain a scientific paper in an accessible format, breaking down complex research into understandable components while preserving technical accuracy.\n\n' +
                'The response should be formatted in markdown with the following structure:\n\n' +
                '# Paper Title\n' +
                '[📄 Paper]({pdf_url}) | [💻 Code](url)\n\n' +
                '## Abstract\n\n' +
                '## Summary in Simple Terms\n\n' +
                '## Main Contributions\n' +
                '1. \n' +
                '2. \n' +
                '...\n\n' +
                '## Background & Significance\n\n' +
                '## Algorithm Steps\n' +
                '1. Input Processing:\n' +
                '   1. \n' +
                '   2. \n' +
                '...\n' +
                '2. Training:\n' +
                '   1. \n' +
                '   2. \n' +
                '...\n' +
                '3. Inference:\n' +
                '   1. \n' +
                '   2. \n' +
                '...\n\n' +
                '## Advantages Over Previous Works\n' +
                '- \n' +
                '- ...\n\n' +
                '## Limitations\n' +
                '1. \n' +
                '2. \n' +
                '...\n\n' +
                '## Technical Terms\n' +
                '- **Term1**: definition\n' +
                '- **Term2**: definition\n' +
                '...\n\n' +
                'Include the original paper URL which is {pdf_url}.\n' +
                'Maintain scientific accuracy while making explanations accessible.\n\n' +
                'For each research paper, provide:\n\n' +
                '1. The title at the top, formatted as a main heading\n' +
                '2. Publishing organizations that released the paper\n' +
                '3. Specific keywords as tags that reflect unique methods, applications, or contributions\n' +
                '4. The official abstract copied from the paper\n' +
                '5. A simplified explanation in layman\'s terms\n' +
                '6. A clear list of the paper\'s main contributions\n' +
                '7. Relevant background information explaining why this research is important now\n' +
                '8. A step-by-step breakdown of the main algorithm or methodology\n' +
                '9. Comparisons to previous work, highlighting improvements\n' +
                '10. Honest assessment of the paper\'s limitations\n' +
                '11. Definitions of specialized technical terms\n' +
                '12. Links to both the original paper and code repository (if available)\n\n' +
                'The analysis should help readers understand both the technical details and practical significance of the research without requiring expert-level knowledge in the field.'
            });
            
            // Show summarizing indicator
            const typingIndicator = document.createElement('div');
            typingIndicator.className = 'response-message typing-indicator';
            typingIndicator.textContent = 'Summarizing...';
            chatMessages.appendChild(typingIndicator);
            
            // Get API key and call OpenAI
            chrome.storage.local.get(['openai_api_key'], async function(result) {
              const apiKey = result.openai_api_key;
              if (!apiKey) {
                chatMessages.removeChild(typingIndicator);
                addMessage("Please add your OpenAI API key in settings to enable chat functionality.", false);
                settingsModal.style.display = 'block';
                return;
              }

              try {
                const aiResponse = await callOpenAI(apiKey, conversation);
                chatMessages.removeChild(typingIndicator);
                addMessage(aiResponse, false);
                conversation.push({ role: 'assistant', content: aiResponse });
              } catch (error) {
                chatMessages.removeChild(typingIndicator);
                addMessage(`Error: ${error.message}`, false);
              }
            });
          }
        };
        
        // Add the listener
        chrome.runtime.onMessage.addListener(messageListener);

        // Get current tab and execute content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['pdf-content.js']
        });
      }
    } catch (error) {
      console.error('Error checking PDF status:', error);
      addMessage("Error extracting PDF content: " + error.message, false);
    }
  }

  // Modify the clearChat function
  async function clearChat() {
    // Clear the UI completely
    chatMessages.innerHTML = '';
    
    // Reset the conversation array
    conversation = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Format your responses using markdown for better readability. Use code blocks with language specifications when providing code.'
      }
    ];

    // Reset PDF state
    pdfContent = '';
    const pdfButton = document.getElementById('pdf-button');
    pdfButton.setAttribute('data-active', 'false');
  }

  // Initial check for PDF
  checkIfPdfPage();

  // Configure marked.js options
  marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false,
    extensions: [{
      name: 'math',
      level: 'block',
      tokenizer(src) {
        const mathMatch = src.match(/^\$\$(.*?)\$\$|\[(.*?)\]/);
        if (mathMatch) {
          return {
            type: 'math',
            raw: mathMatch[0],
            text: mathMatch[1] || mathMatch[2],
            tokens: []
          };
        }
      },
      renderer(token) {
        return `<span class="math-wrapper">${token.raw}</span>`;
      }
    }]
  });

  // Add this after the marked.setOptions configuration
  function handleLinkClick(event) {
    // Check if the clicked element is a link
    if (event.target.tagName === 'A') {
      event.preventDefault();
      const url = event.target.href;
      
      // Open the link in a new tab
      chrome.tabs.create({ url: url });
    }
  }

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
  
  // Add this debug function at the top level
  function debugLog(message, data = null) {
    const debugMsg = data ? `${message}: ${JSON.stringify(data)}` : message;
    console.log(`%c${debugMsg}`, 'color: #0066cc');
  }
  
  // Modify the processMathExpressions function
  function processMathExpressions(text) {
    debugLog('Processing text for math:', text);

    // Helper function to escape special characters
    function escapeLatex(str) {
      return str.replace(/\\/g, '\\\\')
                .replace(/{/g, '\\{')
                .replace(/}/g, '\\}')
                .replace(/_/g, '\\_');
    }

    // First handle display math with double dollar signs
    text = text.replace(/\$\$(.*?)\$\$/g, (match, formula) => {
      debugLog('Found $$ math:', { match, formula });
      try {
        // Don't escape the formula for $$ math
        const rendered = katex.renderToString(formula, {
          displayMode: true,
          throwOnError: false,
          strict: false
        });
        debugLog('Rendered $$ math:', rendered);
        return rendered;
      } catch (error) {
        console.error('KaTeX $$ error:', error);
        return match;
      }
    });

    // Then handle square bracket math
    text = text.replace(/\[(.*?)\]/g, (match, formula) => {
      debugLog('Found [] math:', { match, formula });
      try {
        // Don't escape the formula for [] math
        const rendered = katex.renderToString(formula, {
          displayMode: true,
          throwOnError: false,
          strict: false
        });
        debugLog('Rendered [] math:', rendered);
        return rendered;
      } catch (error) {
        console.error('KaTeX [] error:', error);
        return match;
      }
    });

    debugLog('Final processed text:', text);
    return text;
  }
  
  // Modify the addMessage function
  function addMessage(text, isUser) {
    debugLog('Adding message:', { text, isUser });
    const messageElement = document.createElement('div');
    messageElement.className = isUser ? 'user-message' : 'response-message';
    
    if (isUser) {
      messageElement.textContent = text;
    } else {
      debugLog('Processing AI response');
      
      // First protect math expressions from markdown processing
      const protectedText = text.replace(/(\$\$.*?\$\$|\[.*?\])/g, match => {
        return match.replace(/[_*]/g, '\\$&');
      });
      
      // Process markdown first
      const markedText = marked.parse(protectedText);
      debugLog('Markdown processed text:', markedText);
      
      // Then process math expressions
      const processedText = processMathExpressions(markedText);
      debugLog('Math processed text:', processedText);
      
      // Clean up unwanted br tags around math expressions
      const cleanedText = processedText.replace(/<br>\s*(<span class="math-wrapper">.*?<\/span>)\s*<br>/g, '$1');
      
      messageElement.innerHTML = cleanedText;

      // Add click event listener for links
      messageElement.addEventListener('click', handleLinkClick);
    }
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add syntax highlighting for code blocks
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

  // Modify the clear chat button event listener
  clearChatButton.addEventListener('click', clearChat);

  // Debug KaTeX loading
  if (typeof katex === 'undefined') {
    console.error('KaTeX is not loaded!');
  } else {
    debugLog('KaTeX version:', katex.version);
  }
});
