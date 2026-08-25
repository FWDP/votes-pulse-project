import { Alert, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { colors } from '@/constants/theme'
import { useReports } from '@/context/ReportsContext'
import { useSession } from '@/context/SessionContext'
import { isApiConfigured } from '@/services/apiClient'

export default function ProfileScreen() {
    const { session, signOut } = useSession()
    const { reports } = useReports()
    const queued = reports.filter(report => ['queued', 'sync-failed'].includes(report.status)).length

    const confirmSignOut = () => Alert.alert(
        'Sign out?',
        queued ? `${queued} report${queued === 1 ? ' is' : 's are'} still waiting to synchronize. Local reports will remain on this device.` : 'Local field reports will remain on this device.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => void signOut() }],
    )

    return (
        <Screen title="Profile" subtitle="Field reporting access and connection status">
            <View style={styles.identity}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{session?.user.displayName.slice(0, 1).toUpperCase()}</Text></View>
                <View style={styles.grow}><Text style={styles.name}>{session?.user.displayName}</Text><Text style={styles.email}>{session?.user.email}</Text></View>
            </View>

            <View style={styles.card}>
                <Row label="Role" value={session?.user.role ?? 'field-reporter'} />
                <Row label="Coverage" value={session?.user.coverageLabel ?? 'Assigned coverage'} />
                <Row label="Mode" value={isApiConfigured ? 'Connected API' : 'Local prototype'} />
                <Row label="Waiting to sync" value={String(queued)} last />
            </View>

            {!isApiConfigured && (
                <View style={styles.notice}>
                    <Text style={styles.noticeTitle}>Prototype mode</Text>
                    <Text style={styles.noticeText}>Reports and credentials are stored only on this device. Set EXPO_PUBLIC_API_BASE_URL to enable the future Web App connection.</Text>
                </View>
            )}

            <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
        </Screen>
    )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
    return <View style={[styles.row, last && styles.lastRow]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
    identity: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16 },
    avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy },
    avatarText: { color: '#F8C73A', fontSize: 22, fontWeight: '900' },
    grow: { flex: 1 },
    name: { color: colors.text, fontSize: 17, fontWeight: '800', textTransform: 'capitalize' },
    email: { color: colors.muted, fontSize: 12, marginTop: 3 },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 15 },
    lastRow: { borderBottomWidth: 0 },
    rowLabel: { color: colors.muted, fontSize: 12 },
    rowValue: { color: colors.text, flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    notice: { backgroundColor: colors.warningSoft, borderRadius: 14, padding: 14, gap: 5 },
    noticeTitle: { color: colors.warning, fontSize: 12, fontWeight: '800' },
    noticeText: { color: colors.warning, fontSize: 11, lineHeight: 17 },
})
