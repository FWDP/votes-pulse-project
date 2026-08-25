import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '@/constants/theme'
import type { FieldReport } from '@/types/fieldReports'
import { StatusBadge } from './StatusBadge'

export function ReportCard({ report, onPress, selected = false, selectable = false }: {
    report: FieldReport
    onPress: () => void
    selected?: boolean
    selectable?: boolean
}) {
    return (
        <Pressable
            accessibilityRole={selectable ? 'checkbox' : 'button'}
            accessibilityState={selectable ? { checked: selected } : undefined}
            onPress={onPress}
            style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]}
        >
            <View style={styles.topRow}>
                <View style={styles.idRow}>
                    {selectable && <View style={[styles.checkbox, selected && styles.checkboxSelected]}><Text style={styles.checkmark}>{selected ? '✓' : ''}</Text></View>}
                    <Text style={styles.id}>{report.id}</Text>
                </View>
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
    selected: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    idRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    checkboxSelected: { borderColor: colors.blue, backgroundColor: colors.blue },
    checkmark: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
    id: { color: colors.muted, fontSize: 10, fontWeight: '700' },
    title: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '800' },
    observation: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    meta: { color: colors.navySoft, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    dot: { color: '#98A2B3' },
    critical: { color: colors.danger },
    location: { color: colors.muted, fontSize: 11 },
})
