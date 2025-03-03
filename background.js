// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Check if we can access the tab
    if (!tab.url.startsWith('http') && !tab.url.startsWith('file')) {
      console.log('Cannot access this page. Try opening a webpage or PDF file.');
      return;
    }

    // Inject both CSS and script first
    await Promise.all([
      chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css']
      }),
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      })
    ]);

    // Then send toggle message - no need to wait for response
    chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' })
      .catch(error => console.error('Error toggling sidebar:', error));

  } catch (error) {
    console.error('Error in extension:', error);
  }
});

// Store API key securely
let OPENAI_API_KEY = '';
chrome.storage.local.get(['openai_api_key'], (result) => {
  if (result.openai_api_key) {
    OPENAI_API_KEY = result.openai_api_key;
  }
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle API key setting
  if (request.action === 'setApiKey') {
    OPENAI_API_KEY = request.apiKey;
    chrome.storage.local.set({ openai_api_key: request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true; // Will respond async
  }

  // Handle chat requests
  if (request.action === 'chatWithPDF') {
    handleChatRequest(request.message, request.pdfContent)
      .then(response => {
        sendResponse({ success: true, response });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond async
  }
});

// Chat request handler
async function handleChatRequest(userMessage, pdfContent) {
  if (!OPENAI_API_KEY) {
    throw new Error('Please set your OpenAI API key first');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant analyzing a PDF document. Here is the content of the PDF: ' + pdfContent
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      max_tokens: 500
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to get response from OpenAI');
  }

  return data.choices[0].message.content;
}

// Monitor PDF tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url?.endsWith('.pdf') && changeInfo.status === 'complete') {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(err => {
      console.error('Failed to inject content script:', err);
    });
  }
}); 