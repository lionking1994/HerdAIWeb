import React from 'react'
import ReactDOM from 'react-dom/client'
import './patch-d3'
import './index.css'
import './styles/global.css'
import App from './App'
import reportWebVitals from './reportWebVitals'
import { msalConfig } from './config/azureAuthConfig'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'

// Check if we're in a secure context (HTTPS or localhost)
// crypto.subtle is required by MSAL but only available in secure contexts
const isSecureContext = window.isSecureContext || 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.protocol === 'https:';

let msalInstance = null;

if (isSecureContext && window.crypto?.subtle) {
  try {
    msalInstance = new PublicClientApplication(msalConfig);
  } catch (error) {
    console.warn('MSAL initialization failed:', error.message);
    console.warn('Microsoft Teams authentication will not be available over HTTP.');
  }
} else {
  console.warn('Running in non-secure context (HTTP). Microsoft Teams authentication is disabled.');
  console.warn('To enable Teams auth, access the app via HTTPS or localhost.');
}

const root = ReactDOM.createRoot(document.getElementById('root'))

// Conditionally wrap with MsalProvider only if MSAL is available
const AppWrapper = () => {
  if (msalInstance) {
    return (
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    );
  }
  return <App />;
};

root.render(
  // <React.StrictMode>
  <AppWrapper />
  // </React.StrictMode>
)

reportWebVitals()
