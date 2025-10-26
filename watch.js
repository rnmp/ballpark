const browserSync = require('browser-sync').create();

browserSync.init({
  server: './', // Serve current directory
  files: ['index.html'], // Watch for changes in index.html
  browser: 'default', // Open default browser
  notify: false
});
