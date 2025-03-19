import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ConfigProvider, theme } from 'antd'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider theme={{ token: {}, algorithm: [theme.compactAlgorithm] }}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
