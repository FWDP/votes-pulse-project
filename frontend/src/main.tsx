import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { TenantWorkspaceProvider } from './contexts/TenantWorkspaceContext'
import { preloadRoute } from './routeLoaders'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

void preloadRoute(window.location.pathname)
    .catch(() => undefined)

createRoot(root).render(
	<React.StrictMode>
		<BrowserRouter>
			<AuthProvider>
				<TenantWorkspaceProvider>
					<App />
				</TenantWorkspaceProvider>
			</AuthProvider>
		</BrowserRouter>
	</React.StrictMode>
)
