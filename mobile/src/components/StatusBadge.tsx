import { StyleSheet, Text, View } from 'react-native'

import { colors } from '@/constants/theme'
import type { FieldReportStatus } from '@/types/fieldReports'

const labels: Record<FieldReportStatus, string> = {
    draft: 'Draft',
    queued: 'Queued',
    submitted: 'Submitted',
    'under-review': 'Under review',
    verified: 'Verified',
    'needs-follow-up': 'Follow-up',
    rejected: 'Rejected',
    'sync-failed': 'Sync failed',
}

export function StatusBadge({ status }: { status: FieldReportStatus }) {
    const warning = ['draft', 'queued', 'needs-follow-up'].includes(status)
    const danger = ['rejected', 'sync-failed'].includes(status)
    return (
        <View style={[styles.badge, warning && styles.warning, danger && styles.danger]}>
            <Text style={[styles.label, warning && styles.warningLabel, danger && styles.dangerLabel]}>{labels[status]}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    badge: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.successSoft, paddingHorizontal: 9, paddingVertical: 4 },
    warning: { backgroundColor: colors.warningSoft },
    danger: { backgroundColor: colors.dangerSoft },
    label: { color: colors.success, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    warningLabel: { color: colors.warning },
    dangerLabel: { color: colors.danger },
})
