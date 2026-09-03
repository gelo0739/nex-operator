import React from 'react'
import ReactDOM from 'react-dom/client'
import Dashboard from './(operator)/Dashboard.jsx'
import './index.css' // <-- Required for Tailwind to load

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>,
)