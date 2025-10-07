// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';

import './index.css';
import App from './App.jsx';

// Host-only baseURL so your in-code "/api/..." paths compose correctly
axios.defaults.baseURL = import.meta.env.VITE_API_HOST || 'http://localhost:5000';
axios.defaults.withCredentials = true;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
