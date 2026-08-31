import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { TenantWorkspaceProvider } from './contexts/TenantWorkspaceContext'
import { preloadRoute } from './routeLoaders'
import './index.css'

const CHUNK_RELOAD_KEY = 'votes-chunk-reload-at'
const CHUNK_RELOAD_WINDOW_MS = 15_000

window.addEventListener('vite:preloadError', event => {
	event.preventDefault()

	const now = Date.now()
	const lastReloadAt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0)
	if (now - lastReloadAt < CHUNK_RELOAD_WINDOW_MS) return

	window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
	window.location.reload()
})

window.setTimeout(() => {
	window.sessionStorage.removeItem(CHUNK_RELOAD_KEY)
}, CHUNK_RELOAD_WINDOW_MS)

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
