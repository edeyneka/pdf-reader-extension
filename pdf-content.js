// This content script runs on PDF pages to extract text
function extractPdfText() {
  console.log("PDF extraction script running, checking for PDF content...");
  
  const isPdf = document.querySelector('embed[type="application/pdf"]') || 
                document.querySelector('object[type="application/pdf"]') ||
                window.location.href.endsWith('.pdf');
  
  if (isPdf) {
    console.log("PDF detected on page:", window.location.href);
    
    // Basic detection - there are better ways to extract text from PDFs
    const textElements = document.querySelectorAll('.textLayer div');
    let pdfText = '';
    
    if (textElements.length > 0) {
      console.log(`Found ${textElements.length} text elements in PDF`);
      textElements.forEach(element => {
        pdfText += element.textContent + ' ';
      });
    } else {
      console.log("No text layer found, using fallback message");
      pdfText = "PDF detected, but text extraction requires PDF.js integration. This is a placeholder message as the PDF content couldn't be automatically extracted.";
    }
    
    // Send the extracted text to background script
    console.log("Sending PDF content to background script");
    chrome.runtime.sendMessage({
      action: "pdf_content",
      text: pdfText,
      url: window.location.href
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error sending PDF content:", chrome.runtime.lastError);
      } else {
        console.log("PDF content sent successfully");
      }
    });
  } else {
    console.log("No PDF detected on this page");
  }
}

// Run extraction after the page has loaded
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