#!/bin/bash

# Install terser if not already installed
npm install -g terser

# Minify JavaScript files
terser background.js -o background.min.js
terser pdf-content.js -o pdf-content.min.js
terser sidebar.js -o sidebar.min.js

# Update the build script to use minified versions
cp background.min.js build/background.js
cp pdf-content.min.js build/pdf-content.js
cp sidebar.min.js build/sidebar.js