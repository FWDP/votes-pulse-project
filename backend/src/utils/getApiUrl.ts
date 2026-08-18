const getApiBaseUrl = () => {
    const apiBaseUrl = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? '';
    return apiBaseUrl.replace(/\/+$/, '');
};

export function getApiUrl(
    path: string,
): string {
    const normalizedPath =
        path.startsWith('/')
            ? path
            : `/${path}`

    return `${getApiBaseUrl}${normalizedPath}`
}