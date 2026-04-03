const fs = require('fs');
const path = require('path');

const browserDir = path.join(__dirname, 'dist', 'amtocbot-site', 'browser');

// Copy index.csr.html to index.html for static hosting
const csrFile = path.join(browserDir, 'index.csr.html');
const indexFile = path.join(browserDir, 'index.html');
if (fs.existsSync(csrFile) && !fs.existsSync(indexFile)) {
  fs.copyFileSync(csrFile, indexFile);
  console.log('Copied index.csr.html -> index.html');
}

// Create _redirects for SPA routing on Cloudflare Pages
const redirectsFile = path.join(browserDir, '_redirects');
fs.writeFileSync(redirectsFile, '/*  /index.html  200\n');
console.log('Created _redirects for SPA routing');
