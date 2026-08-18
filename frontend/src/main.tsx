import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { preloadRoute } from './routeLoaders'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

void preloadRoute(window.location.pathname)
    .catch(() => undefined)

createRoot(root).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
