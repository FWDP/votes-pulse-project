import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import { seedReports } from '@/data/seedReports'
import { isApiConfigured } from '@/services/apiClient'
import { submitFieldReport } from '@/services/fieldReportsApi'
import { loadStoredReports, storeReports } from '@/storage/reportStorage'
import type { CreateFieldReportInput, FieldReport } from '@/types/fieldReports'
import { useSession } from './SessionContext'

type SaveIntent = 'draft' | 'submit'

interface ReportsContextValue {
    reports: FieldReport[]
    loading: boolean
    saveReport: (input: CreateFieldReportInput, intent: SaveIntent) => Promise<FieldReport>
    retryReport: (id: string) => Promise<void>
    getReport: (id: string) => FieldReport | undefined
}

const ReportsContext = createContext<ReportsContextValue | null>(null)

const makeLocalId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export function ReportsProvider({ children }: PropsWithChildren) {
    const { session } = useSession()
    const [reports, setReports] = useState<FieldReport[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        void loadStoredReports()
            .then(stored => setReports(stored ?? seedReports))
            .finally(() => setLoading(false))
    }, [])

    const replaceReport = useCallback((next: FieldReport) => {
        setReports(current => {
            const updated = current.map(report => report.id === next.id ? next : report)
            void storeReports(updated)
            return updated
        })
    }, [])

    const syncReport = useCallback(async (report: FieldReport) => {
        if (!session || !isApiConfigured) return

        const syncing: FieldReport = {
            ...report,
            sync: { ...report.sync, state: 'syncing', lastAttemptAt: new Date().toISOString() },
        }
        replaceReport(syncing)

        try {
            const response = await submitFieldReport(syncing, session.token)
            replaceReport({
                ...response.data,
                sync: { state: 'synced', retryCount: syncing.sync.retryCount },
            })
        } catch (error) {
            replaceReport({
                ...syncing,
                status: 'sync-failed',
                sync: {
                    state: 'failed',
                    retryCount: syncing.sync.retryCount + 1,
                    lastAttemptAt: new Date().toISOString(),
                    lastError: error instanceof Error ? error.message : 'Unable to synchronize report',
                },
            })
        }
    }, [replaceReport, session])

    const saveReport = useCallback(async (input: CreateFieldReportInput, intent: SaveIntent) => {
        if (!session) throw new Error('Sign in before saving a field report.')

        const now = new Date().toISOString()
        const clientId = makeLocalId('client')
        const report: FieldReport = {
            ...input,
            id: makeLocalId(intent === 'draft' ? 'DRAFT' : 'FR'),
            clientId,
            reporter: session.user,
            status: intent === 'draft' ? 'draft' : 'queued',
            createdAt: now,
            updatedAt: now,
            submittedAt: intent === 'submit' ? now : undefined,
            sync: {
                state: intent === 'draft' ? 'local' : 'queued',
                retryCount: 0,
            },
        }

        setReports(current => {
            const updated = [report, ...current]
            void storeReports(updated)
            return updated
        })

        if (intent === 'submit') void syncReport(report)
        return report
    }, [session, syncReport])

    const retryReport = useCallback(async (id: string) => {
        const report = reports.find(item => item.id === id)
        if (report) await syncReport({ ...report, status: 'queued', sync: { ...report.sync, state: 'queued' } })
    }, [reports, syncReport])

    const getReport = useCallback((id: string) => reports.find(report => report.id === id), [reports])
    const value = useMemo(
        () => ({ reports, loading, saveReport, retryReport, getReport }),
        [getReport, loading, reports, retryReport, saveReport],
    )

    return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
}

export function useReports() {
    const value = useContext(ReportsContext)
    if (!value) throw new Error('useReports must be used within ReportsProvider')
    return value
}
