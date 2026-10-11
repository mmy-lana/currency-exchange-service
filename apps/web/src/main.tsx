import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// StrictMode is intentionally omitted: its development double-invocation
// duplicates every fetch through the 300ms debounce pipeline, doubling real
// upstream load and consuming the per-IP historical rate budget.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
