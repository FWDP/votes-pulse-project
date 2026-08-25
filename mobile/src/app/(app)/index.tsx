import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { ReportCard } from '@/components/ReportCard'
import { Screen } from '@/components/Screen'
import { colors } from '@/constants/theme'
import { useReports } from '@/context/ReportsContext'
import { useSession } from '@/context/SessionContext'
import type { FieldReportStatus } from '@/types/fieldReports'

type ReportFilter = 'all' | 'outbox' | 'pending' | 'reviewed'

const matchesFilter = (status: FieldReportStatus, filter: ReportFilter) => {
    if (filter === 'all') return true
    if (filter === 'outbox') return ['draft', 'sync-failed'].includes(status)
    if (filter === 'pending') return ['queued', 'submitted', 'sync-failed'].includes(status)
    return ['under-review', 'verified', 'needs-follow-up', 'rejected'].includes(status)
}

export default function ReportsScreen() {
    const { reports, loading, refreshReports, submitReports } = useReports()
    const { session } = useSession()
    const [filter, setFilter] = useState<ReportFilter>('all')
    const [refreshing, setRefreshing] = useState(false)
    const [selecting, setSelecting] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [sending, setSending] = useState(false)
    const visibleReports = useMemo(
        () => reports.filter(report => matchesFilter(report.status, filter)),
        [filter, reports],
    )

    const pendingCount = reports.filter(report => ['queued', 'submitted', 'sync-failed'].includes(report.status)).length
    const draftCount = reports.filter(report => report.status === 'draft').length
    const sendableIds = useMemo(
        () => new Set(reports.filter(report => ['draft', 'sync-failed'].includes(report.status)).map(report => report.id)),
        [reports],
    )

    useEffect(() => {
        setSelectedIds(current => new Set([...current].filter(id => sendableIds.has(id))))
    }, [sendableIds])

    const toggleSelection = (id: string) => {
        setSelectedIds(current => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const sendSelected = async () => {
        if (!selectedIds.size) return
        setSending(true)
        try {
            const result = await submitReports([...selectedIds])
            setSelectedIds(new Set())
            setSelecting(false)
            setFilter('pending')
            Alert.alert(
                result.failed ? 'Some reports could not be sent' : 'Reports sent',
                `${result.sent} sent${result.failed ? `, ${result.failed} failed` : ''}.`,
            )
        } finally {
            setSending(false)
        }
    }

    return (
        <Screen
            title="Field Reports"
            subtitle={session?.user.coverageLabel ?? 'Assigned coverage'}
            scroll={false}
            action={<View style={styles.mode}><Text style={styles.modeText}>{session?.mode === 'connected' ? 'Connected' : 'Prototype'}</Text></View>}
        >
            <View style={styles.summaryRow}>
                <View style={styles.summaryCard}><Text style={styles.summaryValue}>{reports.length}</Text><Text style={styles.summaryLabel}>Total</Text></View>
                <View style={styles.summaryCard}><Text style={styles.summaryValue}>{pendingCount}</Text><Text style={styles.summaryLabel}>Pending</Text></View>
                <View style={styles.summaryCard}><Text style={styles.summaryValue}>{draftCount}</Text><Text style={styles.summaryLabel}>Drafts</Text></View>
            </View>

            <View style={styles.filters}>
                {(['all', 'outbox', 'pending', 'reviewed'] as const).map(item => (
                    <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
                        <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
                    </Pressable>
                ))}
            </View>

            {sendableIds.size > 0 && (
                <View style={styles.selectionBar}>
                    <Pressable
                        onPress={() => {
                            setSelecting(current => !current)
                            setSelectedIds(new Set())
                            setFilter('outbox')
                        }}
                    >
                        <Text style={styles.selectionLink}>{selecting ? 'Cancel selection' : 'Select reports to send'}</Text>
                    </Pressable>
                    {selecting && (
                        <View style={styles.sendButton}><Button label={`Send selected (${selectedIds.size})`} disabled={!selectedIds.size} loading={sending} onPress={() => void sendSelected()} /></View>
                    )}
                </View>
            )}

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>
            ) : (
                <FlatList
                    data={visibleReports}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <ReportCard
                            report={item}
                            selectable={selecting && sendableIds.has(item.id)}
                            selected={selectedIds.has(item.id)}
                            onPress={() => selecting && sendableIds.has(item.id)
                                ? toggleSelection(item.id)
                                : router.push({ pathname: '/(app)/reports/[id]', params: { id: item.id } })}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    ListEmptyComponent={<Text style={styles.empty}>No reports match this filter.</Text>}
                    showsVerticalScrollIndicator={false}
                    refreshing={refreshing}
                    onRefresh={() => {
                        setRefreshing(true)
                        void refreshReports().finally(() => setRefreshing(false))
                    }}
                />
            )}
        </Screen>
    )
}

const styles = StyleSheet.create({
    mode: { backgroundColor: colors.blueSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    modeText: { color: colors.blue, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    summaryRow: { flexDirection: 'row', gap: 10 },
    summaryCard: { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 13 },
    summaryValue: { color: colors.navy, fontSize: 21, fontWeight: '900' },
    summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
    filters: { flexDirection: 'row', gap: 7 },
    selectionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 10 },
    selectionLink: { color: colors.blue, fontSize: 12, fontWeight: '800' },
    sendButton: { flex: 1, maxWidth: 210 },
    filter: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.surface },
    filterActive: { backgroundColor: colors.navy, borderColor: colors.navy },
    filterText: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    filterTextActive: { color: '#FFFFFF' },
    list: { paddingBottom: 18 },
    separator: { height: 11 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 13 },
})
