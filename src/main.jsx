import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { StatusBar, Style } from '@capacitor/status-bar'

// 让系统状态栏透明，内容延伸到状态栏下方（不遮挡真实时间/WiFi）
try {
  StatusBar.setOverlaysWebView({ overlay: true })
  StatusBar.setStyle({ style: Style.Dark })
} catch (e) {
  // 非 Capacitor 环境（浏览器调试）忽略
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
