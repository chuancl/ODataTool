import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// 确保引用了 Tailwind CSS
import '../../assets/main.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
    console.error("Popup: Failed to find #root element");
}