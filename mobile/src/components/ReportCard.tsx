import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '@/constants/theme'
import type { FieldReport } from '@/types/fieldReports'
import { StatusBadge } from './StatusBadge'

export function ReportCard({ report, onPress }: { report: FieldReport; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.topRow}>
                <Text style={styles.id}>{report.id}</Text>
                <StatusBadge status={report.status} />
            </View>
            <Text style={styles.title} numberOfLines={2}>{report.title}</Text>
            <Text style={styles.observation} numberOfLines={2}>{report.observation}</Text>
            <View style={styles.metaRow}>
                <Text style={styles.meta}>{report.topic}</Text>
                <Text style={styles.dot}>•</Text>
                <Text style={[styles.meta, report.severity === 'critical' && styles.critical]}>{report.severity}</Text>
            </View>
            <Text style={styles.location} numberOfLines={1}>⌖ {report.location.label}</Text>
        </Pressable>
    )
}

const styles = StyleSheet.create({
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 9 },
    pressed: { opacity: 0.78 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    id: { color: colors.muted, fontSize: 10, fontWeight: '700' },
    title: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '800' },
    observation: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    meta: { color: colors.navySoft, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    dot: { color: '#98A2B3' },
    critical: { color: colors.danger },
    location: { color: colors.muted, fontSize: 11 },
})
