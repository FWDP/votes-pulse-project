import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { ReportCard } from '@/components/ReportCard'
import { Screen } from '@/components/Screen'
import { colors } from '@/constants/theme'
import { useReports } from '@/context/ReportsContext'
import { useSession } from '@/context/SessionContext'
import type { FieldReportStatus } from '@/types/fieldReports'

type ReportFilter = 'all' | 'drafts' | 'pending' | 'reviewed'

const matchesFilter = (status: FieldReportStatus, filter: ReportFilter) => {
    if (filter === 'all') return true
    if (filter === 'drafts') return status === 'draft'
    if (filter === 'pending') return ['queued', 'submitted', 'sync-failed'].includes(status)
    return ['under-review', 'verified', 'needs-follow-up', 'rejected'].includes(status)
}

export default function ReportsScreen() {
    const { reports, loading } = useReports()
    const { session } = useSession()
    const [filter, setFilter] = useState<ReportFilter>('all')
    const visibleReports = useMemo(
        () => reports.filter(report => matchesFilter(report.status, filter)),
        [filter, reports],
    )

    const pendingCount = reports.filter(report => ['queued', 'submitted', 'sync-failed'].includes(report.status)).length
    const draftCount = reports.filter(report => report.status === 'draft').length

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
                {(['all', 'drafts', 'pending', 'reviewed'] as const).map(item => (
                    <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
                        <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
                    </Pressable>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>
            ) : (
                <FlatList
                    data={visibleReports}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <ReportCard
                            report={item}
                            onPress={() => router.push({ pathname: '/(app)/reports/[id]', params: { id: item.id } })}
                        />
                    )}
                    contentContainerStyle={styles.list}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    ListEmptyComponent={<Text style={styles.empty}>No reports match this filter.</Text>}
                    showsVerticalScrollIndicator={false}
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
    filter: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.surface },
    filterActive: { backgroundColor: colors.navy, borderColor: colors.navy },
    filterText: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    filterTextActive: { color: '#FFFFFF' },
    list: { paddingBottom: 18 },
    separator: { height: 11 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontSize: 13 },
})
