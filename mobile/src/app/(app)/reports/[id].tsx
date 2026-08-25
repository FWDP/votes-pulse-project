import { router, useLocalSearchParams } from 'expo-router'
import { Image, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { StatusBadge } from '@/components/StatusBadge'
import { colors } from '@/constants/theme'
import { useReports } from '@/context/ReportsContext'

export default function ReportDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>()
    const { getReport, retryReport } = useReports()
    const report = getReport(id)

    if (!report) {
        return <Screen title="Report unavailable"><Text style={styles.muted}>This report is no longer stored on this device.</Text><Button label="Back to reports" onPress={() => router.replace('/(app)')} /></Screen>
    }

    const occurredAt = new Date(report.occurredAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    return (
        <Screen title="Report Detail" subtitle={report.id} action={<StatusBadge status={report.status} />}>
            <View style={styles.card}>
                <Text style={styles.title}>{report.title}</Text>
                <Text style={styles.observation}>{report.observation}</Text>
            </View>

            <View style={styles.grid}>
                <Detail label="Topic" value={report.topic} />
                <Detail label="Severity" value={report.severity} />
                <Detail label="Evidence" value={report.evidenceType} />
                <Detail label="Occurred" value={occurredAt} />
            </View>

            <View style={styles.card}>
                <Text style={styles.heading}>Location</Text>
                <Text style={styles.value}>{report.location.label}</Text>
                {report.location.coordinates && (
                    <Text style={styles.muted}>{report.location.coordinates.latitude.toFixed(5)}, {report.location.coordinates.longitude.toFixed(5)}</Text>
                )}
            </View>

            <View style={styles.card}>
                <Text style={styles.heading}>Evidence attachments</Text>
                {report.attachments.length === 0 ? <Text style={styles.muted}>No attachments added.</Text> : report.attachments.map(attachment => (
                    <View key={attachment.id} style={styles.attachment}>
                        {attachment.localUri && <Image source={{ uri: attachment.localUri }} style={styles.thumbnail} />}
                        <View style={styles.grow}><Text style={styles.value} numberOfLines={1}>{attachment.name}</Text><Text style={styles.muted}>{attachment.uploadStatus}</Text></View>
                    </View>
                ))}
            </View>

            <View style={styles.card}>
                <Text style={styles.heading}>Synchronization</Text>
                <Text style={styles.value}>{report.sync.state}</Text>
                {report.sync.lastError && <Text style={styles.error}>{report.sync.lastError}</Text>}
                {report.sync.state === 'failed' && <Button label="Retry synchronization" onPress={() => void retryReport(report.id)} />}
            </View>
        </Screen>
    )
}

function Detail({ label, value }: { label: string; value: string }) {
    return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 9 },
    title: { color: colors.text, fontSize: 20, lineHeight: 27, fontWeight: '800' },
    observation: { color: colors.muted, fontSize: 14, lineHeight: 22 },
    heading: { color: colors.navy, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
    value: { color: colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
    muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    error: { color: colors.danger, fontSize: 11, lineHeight: 16 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    detail: { width: '47%', flexGrow: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 13, gap: 5 },
    detailLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
    detailValue: { color: colors.text, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    attachment: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    thumbnail: { width: 48, height: 48, borderRadius: 9, backgroundColor: colors.background },
    grow: { flex: 1 },
})
