const getApiBaseUrl = () => {
    const apiBaseUrl =
        import.meta.env.VITE_API_BASE_URL ?? ''

    return apiBaseUrl.replace(/\/+$/, '')
}

export function getApiUrl(path: string): string {
    const normalizedPath = path.startsWith('/')
        ? path
        : `/${path}`

    // If the request is to the API root, and the current UI is under /pulse,
    // route to the pulse API namespace so frontend calls hit /api/pulse/*.
    let apiPath = normalizedPath
    try {
        if (typeof window !== 'undefined' && normalizedPath.startsWith('/api/')) {
            if (window.location.pathname.startsWith('/pulse')) {
                apiPath = `/api/pulse/${normalizedPath.slice('/api/'.length)}`
            }
        }
    } catch (e) {
        // ignore environment where window is not available
    }

    return `${getApiBaseUrl()}${apiPath}`
}
