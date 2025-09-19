import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log('Main.tsx loading...');

try {
  const container = document.getElementById('root');
  console.log('Root container found:', container);
  
  if (!container) {
    throw new Error('Root container not found');
  }

  const root = createRoot(container);
  console.log('React root created');
  
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  
  console.log('App rendered successfully');
} catch (error) {
  console.error('Error in main.tsx:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="color: red;">Application Error</h1>
      <p>Failed to load the application. Check the console for details.</p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 10px;">
        ${error instanceof Error ? error.message : 'Unknown error'}
      </pre>
    </div>
  `;
}