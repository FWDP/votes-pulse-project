import NetInfo from '@react-native-community/netinfo'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'

import { isApiConfigured } from '@/services/apiClient'
import { listFieldReports, submitFieldReport, uploadFieldReportAttachments } from '@/services/fieldReportsApi'
import { loadStoredReports, storeReports } from '@/storage/reportStorage'
import type { CreateFieldReportInput, FieldReport } from '@/types/fieldReports'
import { useSession } from './SessionContext'

type SaveIntent = 'draft' | 'submit'

interface ReportsContextValue {
    reports: FieldReport[]
    loading: boolean
    saveReport: (input: CreateFieldReportInput, intent: SaveIntent) => Promise<FieldReport>
    updateDraft: (id: string, input: CreateFieldReportInput, intent: SaveIntent) => Promise<FieldReport>
    deleteDraft: (id: string) => Promise<boolean>
    retryReport: (id: string) => Promise<void>
    submitReports: (ids: string[]) => Promise<{ sent: number; failed: number }>
    refreshReports: () => Promise<void>
    getReport: (id: string) => FieldReport | undefined
}

const ReportsContext = createContext<ReportsContextValue | null>(null)

const makeLocalId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export function ReportsProvider({ children }: PropsWithChildren) {
    const { session } = useSession()
    const [reports, setReports] = useState<FieldReport[]>([])
    const reportsRef = useRef<FieldReport[]>([])
    const syncingClientIds = useRef(new Set<string>())
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        void loadStoredReports()
            .then(stored => {
                const genuineReports = (stored ?? []).filter(report =>
                    !report.clientId.startsWith('seed-'),
                )
                setReports(genuineReports)
                if ((stored?.length ?? 0) !== genuineReports.length) {
                    void storeReports(genuineReports)
                }
            })
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        reportsRef.current = reports
    }, [reports])

    const replaceReport = useCallback((next: FieldReport) => {
        setReports(current => {
            const updated = current.map(report =>
                report.id === next.id || report.clientId === next.clientId ? next : report,
            )
            void storeReports(updated)
            return updated
        })
    }, [])

    const syncReport = useCallback(async (report: FieldReport): Promise<FieldReport | undefined> => {
        if (!session || !isApiConfigured) return
        if (syncingClientIds.current.has(report.clientId)) return
        syncingClientIds.current.add(report.clientId)

        const syncing: FieldReport = {
            ...report,
            sync: { ...report.sync, state: 'syncing', lastAttemptAt: new Date().toISOString() },
        }
        replaceReport(syncing)
        let synchronizedAttachments = syncing.attachments

        try {
            synchronizedAttachments = await uploadFieldReportAttachments(syncing.attachments, session.token)
            const response = await submitFieldReport({ ...syncing, attachments: synchronizedAttachments }, session.token)
            const synchronized = {
                ...response.data,
                id: syncing.id,
                serverId: response.data.id,
                attachments: response.data.attachments.map(attachment => ({
                    ...attachment,
                    localUri: syncing.attachments.find(local => local.name === attachment.name)?.localUri,
                })),
                sync: { state: 'synced', retryCount: syncing.sync.retryCount },
            } satisfies FieldReport
            replaceReport(synchronized)
            return synchronized
        } catch (error) {
            const failed = {
                ...syncing,
                attachments: synchronizedAttachments,
                status: 'sync-failed',
                sync: {
                    state: 'failed',
                    retryCount: syncing.sync.retryCount + 1,
                    lastAttemptAt: new Date().toISOString(),
                    lastError: error instanceof Error ? error.message : 'Unable to synchronize report',
                },
            } satisfies FieldReport
            replaceReport(failed)
            return failed
        } finally {
            syncingClientIds.current.delete(report.clientId)
        }
    }, [replaceReport, session])

    const refreshReports = useCallback(async () => {
        if (!session || !isApiConfigured) return
        const response = await listFieldReports(session.token)
        setReports(current => {
            const localOnly = current.filter(report =>
                ['draft', 'queued', 'sync-failed'].includes(report.status) &&
                !response.data.some(serverReport => serverReport.clientId === report.clientId),
            )
            const synchronized = response.data.map(serverReport => {
                const localReport = current.find(report => report.clientId === serverReport.clientId)
                return localReport
                    ? { ...serverReport, id: localReport.id, serverId: serverReport.id }
                    : serverReport
            })
            const updated = [...localOnly, ...synchronized]
                .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
            void storeReports(updated)
            return updated
        })
    }, [session])

    useEffect(() => {
        if (loading || !session || !isApiConfigured) return
        void refreshReports().catch(error => {
            console.warn('Unable to refresh field reports:', error)
        })
    }, [loading, refreshReports, session])

    useEffect(() => {
        if (!session || !isApiConfigured) return

        const synchronizePending = () => {
            reportsRef.current
                .filter(report => ['queued', 'sync-failed'].includes(report.status))
                .forEach(report => { void syncReport(report) })
        }
        const unsubscribe = NetInfo.addEventListener(state => {
            if (state.isConnected && state.isInternetReachable !== false) synchronizePending()
        })
        void NetInfo.fetch().then(state => {
            if (state.isConnected && state.isInternetReachable !== false) synchronizePending()
        })
        return unsubscribe
    }, [session, syncReport])

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

        if (intent === 'submit') return await syncReport(report) ?? report
        return report
    }, [session, syncReport])

    const updateDraft = useCallback(async (
        id: string,
        input: CreateFieldReportInput,
        intent: SaveIntent,
    ) => {
        const current = reportsRef.current.find(report => report.id === id)
        if (!current || current.status !== 'draft') {
            throw new Error('Only a locally saved draft can be edited.')
        }

        const updated: FieldReport = {
            ...current,
            ...input,
            status: intent === 'draft' ? 'draft' : 'queued',
            submittedAt: intent === 'submit' ? new Date().toISOString() : undefined,
            updatedAt: new Date().toISOString(),
            sync: {
                state: intent === 'draft' ? 'local' : 'queued',
                retryCount: current.sync.retryCount,
                lastError: undefined,
            },
        }
        replaceReport(updated)

        if (intent === 'submit') return await syncReport(updated) ?? updated
        return updated
    }, [replaceReport, syncReport])

    const deleteDraft = useCallback(async (id: string) => {
        const current = reportsRef.current.find(report => report.id === id)
        if (!current || current.status !== 'draft') return false

        setReports(reports => {
            const updated = reports.filter(report => report.id !== id)
            void storeReports(updated)
            return updated
        })
        return true
    }, [])

    const submitReports = useCallback(async (ids: string[]) => {
        const selectedIds = new Set(ids)
        const selected = reportsRef.current.filter(report =>
            selectedIds.has(report.id) && ['draft', 'sync-failed'].includes(report.status),
        )
        const results = await Promise.all(selected.map(async report => {
            const queued: FieldReport = {
                ...report,
                status: 'queued',
                submittedAt: report.submittedAt ?? new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                sync: { ...report.sync, state: 'queued', lastError: undefined },
            }
            replaceReport(queued)
            return syncReport(queued)
        }))
        const sent = results.filter(result => result?.sync.state === 'synced').length
        return { sent, failed: selected.length - sent }
    }, [replaceReport, syncReport])

    const retryReport = useCallback(async (id: string) => {
        await submitReports([id])
    }, [submitReports])

    const getReport = useCallback((id: string) => reports.find(report => report.id === id), [reports])
    const value = useMemo(
        () => ({ reports, loading, saveReport, updateDraft, deleteDraft, retryReport, submitReports, refreshReports, getReport }),
        [deleteDraft, getReport, loading, refreshReports, reports, retryReport, saveReport, submitReports, updateDraft],
    )

    return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
}

export function useReports() {
    const value = useContext(ReportsContext)
    if (!value) throw new Error('useReports must be used within ReportsProvider')
    return value
}
