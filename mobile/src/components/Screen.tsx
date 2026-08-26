import type { PropsWithChildren, ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors } from '@/constants/theme'

interface ScreenProps extends PropsWithChildren {
    title?: string
    subtitle?: string
    action?: ReactNode
    scroll?: boolean
}

export function Screen({ title, subtitle, action, scroll = true, children }: ScreenProps) {
    const content = (
        <View style={styles.content}>
            {(title || subtitle || action) && (
                <View style={styles.header}>
                    <View style={styles.headerCopy}>
                        {title && <Text style={styles.title}>{title}</Text>}
                        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                    </View>
                    {action}
                </View>
            )}
            {children}
        </View>
    )

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            {scroll ? (
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    {content}
                </ScrollView>
            ) : content}
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1 },
    content: { flex: 1, padding: 20, gap: 16 },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    headerCopy: { flex: 1 },
    title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: '800' },
    subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
})
