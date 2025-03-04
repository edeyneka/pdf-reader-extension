// Function to load PDF.js script
async function loadPdfJs() {
  try {
    // Import PDF.js as a module
    const pdfjs = await import(chrome.runtime.getURL('js/pdf.mjs'));
    // Set the worker source
    pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('js/pdf.worker.mjs');
    return pdfjs;
  } catch (error) {
    console.error('Error loading PDF.js:', error);
    throw error;
  }
}

async function extractPdfText() {
  console.log("PDF extraction script running with PDF.js...");
  
  try {
    // Load PDF.js first
    const pdfjsLib = await loadPdfJs();
    console.log("PDF.js loaded successfully");

    // Get the URL and handle blob URLs
    const url = window.location.href;
    let loadingTask;
    
    if (url.startsWith('blob:')) {
      // For blob URLs, we need to fetch the PDF data
      const response = await fetch(url);
      const pdfData = await response.arrayBuffer();
      loadingTask = pdfjsLib.getDocument({ data: pdfData });
    } else {
      loadingTask = pdfjsLib.getDocument(url);
    }
    
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `Page ${i}:\n${pageText}\n\n`;
    }
    
    // Send the extracted text to background script
    chrome.runtime.sendMessage({
      action: "pdf_content",
      text: fullText || "No text content found in PDF",
      url: url
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error sending PDF content:", chrome.runtime.lastError);
      } else {
        console.log("PDF content sent successfully");
      }
    });
    
  } catch (error) {
    console.error("PDF.js extraction error:", error);
    
    // Fallback to old method if PDF.js fails
    const textElements = document.querySelectorAll('.textLayer div');
    let pdfText = '';
    
    if (textElements.length > 0) {
      textElements.forEach(element => {
        pdfText += element.textContent + ' ';
      });
    } else {
      pdfText = "PDF text extraction failed. The PDF might be scanned or protected.";
    }
    
    chrome.runtime.sendMessage({
      action: "pdf_content",
      text: pdfText,
      url: window.location.href
    });
  }
}

// Run extraction after a delay to ensure page is loaded
setTimeout(extractPdfText, 2000);

// Also try extracting when the page is fully loaded
window.addEventListener('load', extractPdfText);

// Make sure your script detects when it's running on a PDF page
document.addEventListener('DOMContentLoaded', function() {
  // Check if this is a PDF document
  const isPdf = document.contentType === 'application/pdf' || 
                window.location.href.includes('.pdf');
  
  if (isPdf) {
    console.log('PDF detected, initializing extension...');
    // Your PDF handling code
  }
});

// Listen for messages from the sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkIfPdf") {
    const isPdf = document.querySelector('embed[type="application/pdf"]') !== null ||
                 window.location.href.toLowerCase().endsWith('.pdf');
    sendResponse({ isPdf });
  }
  return true;
}); 