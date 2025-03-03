// Check if current page is a PDF
function isPDF() {
  return document.querySelector('embed[type="application/pdf"]') !== null;
}

// Create and inject sidebar
function createSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'pdf-chat-sidebar';
  
  const toggleButton = document.createElement('button');
  toggleButton.id = 'toggle-sidebar';
  toggleButton.innerHTML = '💬';
  
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('sidebar.html');
  iframe.id = 'pdf-chat-iframe';
  
  sidebar.appendChild(toggleButton);
  sidebar.appendChild(iframe);
  document.body.appendChild(sidebar);

  // Toggle sidebar visibility
  toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    if (sidebar.classList.contains('collapsed')) {
      toggleButton.innerHTML = '💬';
    } else {
      toggleButton.innerHTML = '✕';
    }
  });

  // Initialize as collapsed
  sidebar.classList.add('collapsed');
}

// Extract text content from PDF viewer
function extractPDFContent() {
  const pdfViewer = document.querySelector('embed[type="application/pdf"]');
  // This is a simplified version. You'll need to use PDF.js to properly extract text
  return pdfViewer?.textContent || '';
}

// Initialize if PDF is detected
if (isPDF()) {
  createSidebar();
}

// Listen for messages from sidebar iframe
window.addEventListener('message', (event) => {
  if (event.data.action === 'getPDFContent') {
    const content = extractPDFContent();
    event.source.postMessage({ action: 'pdfContent', content }, '*');
  }
}); 