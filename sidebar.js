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
  const autoSummarizeToggle = document.getElementById('auto-summarize');

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
            conversation.push({
              role: 'system',
              content: 'Here is the PDF content to provide context for user questions. Use this content to answer questions:\n\n' + pdfContent
            });
            
            chrome.runtime.onMessage.removeListener(messageListener);
            
            // Check auto-summarize setting before triggering summary
            chrome.storage.local.get(['auto_summarize'], function(result) {
              if (result.auto_summarize) {
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
                
                // Create a response container for the summary
                const responseContainer = document.createElement('div');
                responseContainer.className = 'response-message';
                chatMessages.appendChild(responseContainer);
                
                // Get API key and call OpenAI
                chrome.storage.local.get(['openai_api_key'], async function(result) {
                  const apiKey = result.openai_api_key;
                  if (!apiKey) {
                    responseContainer.textContent = "Please add your OpenAI API key in settings to enable chat functionality.";
                    settingsModal.style.display = 'block';
                    return;
                  }

                  try {
                    const stream = await callOpenAI(apiKey, conversation);
                    let responseText = '';
                    let markdownBuffer = '';
                    
                    const processMarkdown = debounce((text) => {
                      responseContainer.innerHTML = marked.parse(text);
                      chatMessages.scrollTop = chatMessages.scrollHeight;
                    }, 50);

                    for await (const chunk of stream.streamResponse()) {
                      responseText += chunk;
                      markdownBuffer += chunk;
                      processMarkdown(markdownBuffer);
                    }

                    // Final markdown processing
                    processMarkdown(responseText);
                    
                    // Add the complete response to conversation
                    conversation.push({ role: 'assistant', content: responseText });
                    
                    // Add click event listener for links
                    responseContainer.addEventListener('click', handleLinkClick);
                    
                    // Apply syntax highlighting if there are code blocks
                    if (responseContainer.querySelectorAll('pre code').length > 0) {
                      responseContainer.querySelectorAll('pre code').forEach(block => {
                        block.classList.add('code-block');
                      });
                    }
                  } catch (error) {
                    responseContainer.textContent = `Error: ${error.message}`;
                  }
                });
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
    
    // Save PDF context before resetting
    const savedPdfContent = pdfContent;
    const wasPdfPage = isPdfPage;
    
    // Reset the conversation array
    conversation = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Format your responses using markdown for better readability. Use code blocks with language specifications when providing code.'
      }
    ];

    // If we're on a PDF page, restore the PDF context to the conversation
    if (wasPdfPage && savedPdfContent) {
      conversation.push({
        role: 'system',
        content: 'Here is the PDF content to provide context for user questions. Use this content to answer questions:\n\n' + savedPdfContent
      });
      pdfContent = savedPdfContent; // Restore the PDF content
    } else {
      // Only reset PDF state if not on a PDF page
      pdfContent = '';
      const pdfButton = document.getElementById('pdf-button');
      if (pdfButton) {
        pdfButton.setAttribute('data-active', 'false');
      }
    }
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
    chrome.storage.local.get(['openai_api_key', 'auto_summarize'], function(result) {
      if (result.openai_api_key) {
        apiKeyInput.value = result.openai_api_key;
      }
      autoSummarizeToggle.checked = result.auto_summarize || false;
    });
  }
  
  // Save API key to storage
  function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.local.set({ 
        'openai_api_key': apiKey,
        'auto_summarize': autoSummarizeToggle.checked 
      }, function() {
        saveStatus.textContent = 'Settings saved successfully!';
        saveStatus.className = 'save-status success';
        setTimeout(() => {
          saveStatus.textContent = '';
        }, 3000);
        
        settingsModal.style.display = 'none';
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
  
  // Modify the addMessage function to pre-process math before markdown
  function addMessage(text, isUser) {
    debugLog('Adding message:', { text, isUser });
    const messageElement = document.createElement('div');
    messageElement.className = isUser ? 'user-message' : 'response-message';
    
    if (isUser) {
      messageElement.textContent = text;
    } else {
      debugLog('Processing AI response with new math handling');
      
      // Preserve code blocks first
      const codeBlocks = [];
      let processedText = text.replace(/```([\s\S]+?)```/g, (match) => {
        codeBlocks.push(match);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
      });
      
      // Remove any literal "< br >" text
      processedText = processedText.replace(/< *br *>/gi, '');
      
      // PRE-PROCESS: Convert all math notations to HTML before markdown processing
      
      // 1. Handle display math with double dollar signs
      processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
        try {
          return `<div class="math-block">${katex.renderToString(formula.trim(), {
            displayMode: true,
            throwOnError: false
          })}</div>`;
        } catch (error) {
          return `<div class="math-block-fallback">${formula.trim()}</div>`;
        }
      });
      
      // 2. Handle display math with \[...\]
      processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
        try {
          return `<div class="math-block">${katex.renderToString(formula.trim(), {
            displayMode: true,
            throwOnError: false
          })}</div>`;
        } catch (error) {
          return `<div class="math-block-fallback">${formula.trim()}</div>`;
        }
      });
      
      // 3. Handle inline math with \(...\) - using a more robust regex
      processedText = processedText.replace(/\\\(([^\)]+?)\\\)/g, (match, formula) => {
        try {
          return katex.renderToString(formula.trim(), {
            displayMode: false,
            throwOnError: false
          });
        } catch (error) {
          return `<span class="math-inline-fallback">${formula.trim()}</span>`;
        }
      });
      
      // 4. Special case for N_j, theta_j, etc. - direct text replacement
      processedText = processedText.replace(/\\theta_j/g, 'θ<sub>j</sub>');
      processedText = processedText.replace(/\\theta/g, 'θ');
      processedText = processedText.replace(/N_j/g, 'N<sub>j</sub>');
      
      // Process with markdown
      processedText = marked.parse(processedText);
      
      // Restore code blocks
      codeBlocks.forEach((block, index) => {
        processedText = processedText.replace(`__CODE_BLOCK_${index}__`, block);
      });
      
      // Add custom styles for math rendering
      const style = document.createElement('style');
      style.textContent = `
        .math-block, .math-block-fallback {
          text-align: center;
          margin: 1em 0;
          padding: 0.5em;
        }
        .math-block-fallback, .math-inline-fallback {
          font-family: 'Latin Modern Math', 'Times New Roman', serif;
          font-style: italic;
        }
        .math-block-fallback {
          background-color: #f8f8f8;
          border-radius: 4px;
        }
      `;
      document.head.appendChild(style);
      
      messageElement.innerHTML = processedText;
      
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
  
  // Modify the callOpenAI function to support streaming
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
          max_tokens: 1000,
          stream: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let wordBuffer = '';
      let fullResponse = '';

      return {
        async *streamResponse() {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // Yield any remaining content in the word buffer
                if (wordBuffer) {
                  fullResponse += wordBuffer;
                  yield wordBuffer;
                }
                break;
              }

              buffer += decoder.decode(value);
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.trim() === 'data: [DONE]') return;

                try {
                  const json = JSON.parse(line.replace(/^data: /, ''));
                  const content = json.choices[0]?.delta?.content || '';
                  
                  if (content) {
                    wordBuffer += content;
                    
                    // Check for complete words (space, punctuation, or newline)
                    const words = wordBuffer.match(/[^\s\n]+[\s\n]*|[\r\n]+/g);
                    
                    if (words) {
                      // Keep the last partial word in the buffer
                      const lastWord = words[words.length - 1];
                      const completeWords = words.slice(0, -1).join('');
                      
                      if (completeWords) {
                        fullResponse += completeWords;
                        yield completeWords;
                      }
                      
                      // If the last word ends with space/newline, emit it too
                      if (lastWord.match(/[\s\n]$/)) {
                        fullResponse += lastWord;
                        yield lastWord;
                        wordBuffer = '';
                      } else {
                        wordBuffer = lastWord;
                      }
                    }
                  }
                } catch (e) {
                  console.error('Error parsing JSON:', e);
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        },
        getFullResponse() {
          return fullResponse;
        }
      };
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }
  
  // Modify handleSendMessage to handle streaming
  async function handleSendMessage() {
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    chatInput.value = '';
    addMessage(userMessage, true);
    conversation.push({ role: 'user', content: userMessage });

    // Create a response message container
    const responseContainer = document.createElement('div');
    responseContainer.className = 'response-message';
    chatMessages.appendChild(responseContainer);

    let responseText = '';
    let markdownBuffer = '';
    const processMarkdown = debounce((text) => {
      responseContainer.innerHTML = marked.parse(text);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 50);

    chrome.storage.local.get(['openai_api_key'], async function(result) {
      const apiKey = result.openai_api_key;
      if (!apiKey) {
        responseContainer.textContent = "Please add your OpenAI API key in settings to enable chat functionality.";
        settingsModal.style.display = 'block';
        return;
      }

      try {
        const stream = await callOpenAI(apiKey, conversation);
        
        for await (const chunk of stream.streamResponse()) {
          responseText += chunk;
          markdownBuffer += chunk;
          
          // Process markdown periodically
          processMarkdown(markdownBuffer);
        }

        // Final markdown processing
        processMarkdown(responseText);
        
        // Add the complete response to conversation
        conversation.push({ role: 'assistant', content: responseText });
        
        // Add click event listener for links
        responseContainer.addEventListener('click', handleLinkClick);
        
        // Apply syntax highlighting if there are code blocks
        if (responseContainer.querySelectorAll('pre code').length > 0) {
          responseContainer.querySelectorAll('pre code').forEach(block => {
            block.classList.add('code-block');
          });
        }
      } catch (error) {
        responseContainer.textContent = `Error: ${error.message}`;
      }
    });
  }
  
  // Add a debounce utility function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
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

  // Check for API key immediately when sidebar loads
  chrome.storage.local.get(['openai_api_key'], function(result) {
    if (!result.openai_api_key) {
      settingsModal.style.display = 'block';
    }
  });
});
