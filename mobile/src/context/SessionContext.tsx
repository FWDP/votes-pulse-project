import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import { revokeSession, signIn as requestSignIn } from '@/services/authApi'
import { clearStoredSession, loadStoredSession, storeSession } from '@/storage/sessionStorage'
import type { MobileSession } from '@/types/session'

interface SessionContextValue {
    session: MobileSession | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<void>
    signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: PropsWithChildren) {
    const [session, setSession] = useState<MobileSession | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        void loadStoredSession()
            .then(setSession)
            .finally(() => setLoading(false))
    }, [])

    const signIn = useCallback(async (email: string, password: string) => {
        const nextSession = await requestSignIn({ email, password })
        await storeSession(nextSession)
        setSession(nextSession)
    }, [])

    const signOut = useCallback(async () => {
        if (session) {
            await revokeSession(session.token).catch(error => {
                console.warn('Unable to revoke remote mobile session:', error)
            })
        }
        await clearStoredSession()
        setSession(null)
    }, [session])

    const value = useMemo(() => ({ session, loading, signIn, signOut }), [loading, session, signIn, signOut])
    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
    const value = useContext(SessionContext)
    if (!value) throw new Error('useSession must be used within SessionProvider')
    return value
}
