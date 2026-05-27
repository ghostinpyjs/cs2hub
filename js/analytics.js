// Vercel Web Analytics initialization
// This file initializes Vercel Analytics for the CS2HUB project

(function() {
  'use strict';
  
  // Initialize analytics queue
  if (!window.va) {
    window.va = function va() {
      (window.vaq = window.vaq || []).push(arguments);
    };
  }
  
  // Check if script is already loaded
  if (document.querySelector('script[src*="/_vercel/insights/script.js"]')) {
    return;
  }
  
  // Create and inject the analytics script
  const script = document.createElement('script');
  script.src = '/_vercel/insights/script.js';
  script.defer = true;
  
  script.onerror = function() {
    console.warn('[Vercel Web Analytics] Failed to load analytics script. Please ensure Web Analytics is enabled in your Vercel project settings.');
  };
  
  document.head.appendChild(script);
})();
