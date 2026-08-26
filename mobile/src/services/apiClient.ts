import Constants from 'expo-constants'

const configuredBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
    ''

export const apiBaseUrl = configuredBaseUrl.replace(/\/+$/, '')
export const isApiConfigured = Boolean(apiBaseUrl)

interface RequestOptions extends RequestInit {
    token?: string
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!apiBaseUrl) throw new Error('Mobile API base URL is not configured')

    const { token, headers, ...requestOptions } = options
    const response = await fetch(`${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
        ...requestOptions,
        headers: {
            Accept: 'application/json',
            ...(requestOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
    })

    if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null
        throw new Error(payload?.message ?? payload?.error ?? `VOTES API returned ${response.status}`)
    }

    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
}
