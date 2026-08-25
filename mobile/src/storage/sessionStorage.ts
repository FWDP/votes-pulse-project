import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import type { MobileSession } from '@/types/session'

const SESSION_KEY = 'votes.mobile.session.v1'

export async function loadStoredSession(): Promise<MobileSession | null> {
    const value = Platform.OS === 'web'
        ? await AsyncStorage.getItem(SESSION_KEY)
        : await SecureStore.getItemAsync(SESSION_KEY)
    if (!value) return null

    try {
        const session = JSON.parse(value) as MobileSession
        if (!session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
            await clearStoredSession()
            return null
        }
        return session
    } catch {
        await clearStoredSession()
        return null
    }
}

export const storeSession = (session: MobileSession) => Platform.OS === 'web'
    ? AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session))
    : SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session))

export const clearStoredSession = () => Platform.OS === 'web'
    ? AsyncStorage.removeItem(SESSION_KEY)
    : SecureStore.deleteItemAsync(SESSION_KEY)
