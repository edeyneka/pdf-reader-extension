#!/bin/bash

# Create build directory
rm -rf build
mkdir build

# Copy necessary files
cp manifest.json build/
cp background.js build/
cp pdf-content.js build/
cp sidebar.html build/
cp sidebar.js build/
cp sidebar.css build/
cp katex.min.css build/

# Create directories
mkdir -p build/js
mkdir -p build/icons

# Copy js files
cp js/pdf.mjs build/js/
cp js/pdf.worker.mjs build/js/
cp js/marked.min.js build/js/
cp js/katex.min.js build/js/

# Copy icons
cp icons/icon16.png build/icons/
cp icons/icon32.png build/icons/
cp icons/icon48.png build/icons/
cp icons/icon128.png build/icons/

# Create zip file
cd build
zip -r ../pdf-ai-reader.zip .
cd ..

echo "Build completed! The extension package is ready at pdf-ai-reader.zip"