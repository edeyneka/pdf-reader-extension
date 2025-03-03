console.log('PDF Reader Extension content script starting...');

// Check if current page is a PDF
function isPDF() {
  return document.querySelector('embed[type="application/pdf"]') !== null;
}

// Create and inject the sidebar
function createSidebar() {
  console.log('Creating sidebar...');
  
  // Remove any existing sidebar
  const existingSidebar = document.getElementById('pdf-reader-sidebar');
  if (existingSidebar) {
    existingSidebar.remove();
  }
  
  const sidebar = document.createElement('div');
  sidebar.id = 'pdf-reader-sidebar';
  sidebar.style.display = 'block';
  sidebar.style.zIndex = '999999';
  
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <h3>PDF Reader Chat</h3>
      <button id="close-sidebar">×</button>
    </div>
    <div id="api-key-section">
      <input type="password" id="api-key-input" placeholder="Enter OpenAI API Key">
      <button id="save-api-key">Save</button>
    </div>
    <div class="chat-container">
      <div id="chat-messages"></div>
      <div class="chat-input-container">
        <textarea id="chat-input" placeholder="Ask about the PDF..."></textarea>
        <button id="send-message">Send</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  console.log('Sidebar added to document');
  
  // Add event listeners
  document.getElementById('close-sidebar').addEventListener('click', () => {
    sidebar.style.display = 'none';
  });
  
  document.getElementById('save-api-key').addEventListener('click', () => {
    const apiKey = document.getElementById('api-key-input').value;
    if (!apiKey) {
      alert('Please enter an API key');
      return;
    }
    chrome.storage.local.set({ 'openai_api_key': apiKey }, () => {
      alert('API key saved!');
      document.getElementById('api-key-section').style.display = 'none';
    });
  });
  
  document.getElementById('send-message').addEventListener('click', sendMessage);
}

// Extract text content from PDF viewer
function extractPDFContent() {
  const pdfViewer = document.querySelector('embed[type="application/pdf"]');
  // This is a simplified version. You'll need to use PDF.js to properly extract text
  return pdfViewer?.textContent || '';
}

// Send message function
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  
  const messagesDiv = document.getElementById('chat-messages');
  messagesDiv.innerHTML += `
    <div class="message user-message">
      ${message}
    </div>
  `;
  
  input.value = '';
  
  // Mock response for now
  messagesDiv.innerHTML += `
    <div class="message assistant-message">
      This is a mock response. API integration coming soon!
    </div>
  `;
}

// Listen for toggle message
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'toggleSidebar') {
    const sidebar = document.getElementById('pdf-reader-sidebar');
    if (!sidebar) {
      createSidebar();
    } else {
      sidebar.style.display = sidebar.style.display === 'none' ? 'block' : 'none';
    }
  }
  
  return true;
});

// Listen for messages from sidebar iframe
window.addEventListener('message', (event) => {
  if (event.data.action === 'getPDFContent') {
    const content = extractPDFContent();
    event.source.postMessage({ action: 'pdfContent', content }, '*');
  }
});

console.log('PDF Reader Extension content script ready'); 