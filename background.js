// This script handles the sidebar functionality
// The setPanelState method doesn't exist - removing it

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Improved PDF detection
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if URL ends with .pdf or contains pdf indicators
    const isPdfUrl = tab.url.toLowerCase().endsWith('.pdf') || 
                    tab.url.toLowerCase().includes('pdf') ||
                    tab.url.toLowerCase().includes('viewerng');
    
    if (isPdfUrl) {
      console.log("Potential PDF detected at URL:", tab.url);
      
      // Execute script to check if it's actually a PDF
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: checkForPdfContent
      }).then(results => {
        if (results && results[0] && results[0].result) {
          console.log("PDF confirmed by content script");
          // Notify sidebar that we've found a PDF
          chrome.runtime.sendMessage({ 
            action: "pdf_detected", 
            url: tab.url 
          });
          
          // Try to extract content
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractPdfText
          });
        }
      }).catch(err => {
        console.error("Error executing script:", err);
      });
    }
  }
});

// Helper function to check if page is a PDF
function checkForPdfContent() {
  // Various ways to detect a PDF
  const hasPdfEmbed = document.querySelector('embed[type="application/pdf"]') !== null;
  const hasPdfObject = document.querySelector('object[type="application/pdf"]') !== null;
  const hasPdfViewer = document.querySelector('.textLayer') !== null;
  const hasCanvasPages = document.querySelectorAll('canvas').length > 0 && 
                         document.querySelectorAll('.page').length > 0;
                         
  console.log("PDF detection results:", { 
    hasPdfEmbed, hasPdfObject, hasPdfViewer, hasCanvasPages 
  });
  
  return hasPdfEmbed || hasPdfObject || hasPdfViewer || hasCanvasPages;
}

// Extract text from PDF - improved version
function extractPdfText() {
  console.log("Attempting to extract text from PDF");
  
  // Create a visible status message on the page
  const statusDiv = document.createElement('div');
  statusDiv.style.position = 'fixed';
  statusDiv.style.top = '10px';
  statusDiv.style.right = '10px';
  statusDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
  statusDiv.style.color = 'white';
  statusDiv.style.padding = '10px';
  statusDiv.style.borderRadius = '5px';
  statusDiv.style.zIndex = '9999';
  statusDiv.textContent = 'PDF AI Extension: Extracting content...';
  document.body.appendChild(statusDiv);
  
  let pdfText = "";
  
  try {
    // First attempt: Try standard PDF viewers
    const textLayers = document.querySelectorAll('.textLayer div');
    if (textLayers.length > 0) {
      textLayers.forEach(el => { pdfText += el.textContent + " "; });
      statusDiv.textContent = `Found ${textLayers.length} text elements`;
    }
    
    // Second attempt: Look for PDF.js specific elements
    if (pdfText.length < 100) {
      const pdfViewer = document.querySelector('#viewer .page');
      if (pdfViewer) {
        pdfText = pdfViewer.textContent;
        statusDiv.textContent = 'Extracted text from PDF.js viewer';
      }
    }
    
    // Third attempt: Get any text from page divs
    if (pdfText.length < 100) {
      const allPageText = Array.from(document.querySelectorAll('.page')).map(p => p.textContent).join(' ');
      if (allPageText.length > pdfText.length) {
        pdfText = allPageText;
        statusDiv.textContent = 'Extracted text from page divs';
      }
    }
    
    // Last resort: Get body text if it seems like PDF content
    if (pdfText.length < 100) {
      const bodyText = document.body.innerText;
      pdfText = bodyText;
      statusDiv.textContent = 'Extracted all page text';
    }
    
    // Send the extracted text
    setTimeout(() => {
      if (pdfText.trim().length > 20) {
        statusDiv.textContent = `Extracted ${pdfText.length} characters`;
        chrome.runtime.sendMessage({
          action: "pdf_content",
          text: pdfText,
          url: window.location.href
        });
      } else {
        statusDiv.textContent = 'Not enough text found';
        chrome.runtime.sendMessage({
          action: "pdf_content", 
          text: "PDF detected, but extraction was limited. This PDF might be image-based or protected.",
          url: window.location.href
        });
      }
      
      // Remove the status div after 3 seconds
      setTimeout(() => statusDiv.remove(), 3000);
    }, 1000);
  } catch (err) {
    statusDiv.textContent = 'Error: ' + err.message;
    console.error("PDF extraction error:", err);
    setTimeout(() => statusDiv.remove(), 3000);
  }
}

// Listen for messages from content script with PDF text
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "pdf_content") {
    console.log("Background script received PDF content from content script");
    
    // Forward PDF content to sidebar
    chrome.runtime.sendMessage({ 
      action: "pdf_content", 
      text: request.text,
      url: request.url
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error forwarding PDF content to sidebar:", chrome.runtime.lastError);
      } else {
        console.log("PDF content forwarded to sidebar successfully");
      }
    });
    
    // Always send a response to the content script
    sendResponse({success: true});
    return true; // Keep the message channel open for async response
  }
  // Handle manual PDF check requests
  if (request.action === "check_for_pdf") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs[0]) {
        const activeTab = tabs[0];
        // The same script that's in the sidebar.js will execute here
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: checkForPdfContent
        }).then(results => {
          if (results && results[0] && results[0].result) {
            chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              function: extractPdfText
            });
          } else {
            chrome.runtime.sendMessage({ action: "not_pdf" });
          }
        }).catch(err => {
          console.error("Error executing script:", err);
          chrome.runtime.sendMessage({ 
            action: "pdf_content",
            text: "Error checking for PDF: " + err.message,
            url: tabs[0].url
          });
        });
      }
    });
    return true; // Keep the message channel open
  }
  // Handle PDF fetching
  if (request.action === "fetch_pdf") {
    console.log("Fetching PDF from URL:", request.url);
    
    // Fetch the PDF binary data
    fetch(request.url)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.arrayBuffer();
      })
      .then(arrayBuffer => {
        // Convert ArrayBuffer to Base64
        const base64String = arrayBufferToBase64(arrayBuffer);
        
        // Send the base64 string to the sidebar
        chrome.runtime.sendMessage({
          action: "pdf_base64",
          url: request.url,
          base64Data: base64String
        });
      })
      .catch(error => {
        console.error("Error fetching PDF:", error);
        chrome.runtime.sendMessage({
          action: "pdf_error",
          error: error.message
        });
      });
    
    return true; // Keeps the message channel open for async response
  }
});

// Helper function to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url.includes('arxiv.org/pdf')) {
    console.log('ArXiv PDF detected');
    chrome.tabs.sendMessage(tabId, { type: 'ARXIV_PDF_LOADED' });
  }
});

// Simplify the message handling in background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "pdf_content") {
    // Forward the PDF content to sidebar with a different action name
    chrome.runtime.sendMessage({
      action: "pdf_content_for_sidebar",
      text: message.text,
      url: message.url
    }).catch(() => {
      // Ignore errors when sidebar isn't ready
      console.log("Sidebar not ready yet");
    });
  }
  return true; // Keep the message channel open
}); 