import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import "@fontsource/material-icons-outlined/index.css";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker Registration for PWA Offline Support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Using a clean URL that matches our WordPress rewrite rule
    const swUrl = `${window.yeePOSData?.siteUrl || ''}/yeepos-sw.js`;
    navigator.serviceWorker.register(swUrl, { scope: '/' })
      .then(reg => console.log('[YeePOS] Service Worker registered via Direct Link. Scope:', reg.scope))
      .catch(err => console.error('[YeePOS] Service Worker registration failed:', err));
  });
}
