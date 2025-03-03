let OPENAI_API_KEY = '';

// Store API key securely
chrome.storage.local.get(['openai_api_key'], (result) => {
  if (result.openai_api_key) {
    OPENAI_API_KEY = result.openai_api_key;
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setApiKey') {
    OPENAI_API_KEY = request.apiKey;
    chrome.storage.local.set({ openai_api_key: request.apiKey });
    sendResponse({ success: true });
  }
  
  if (request.action === 'chatWithPDF') {
    handleChatRequest(request.message, request.pdfContent)
      .then(response => sendResponse({ success: true, response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async response
  }
});

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