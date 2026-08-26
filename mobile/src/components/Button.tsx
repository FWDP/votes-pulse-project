import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'

import { colors } from '@/constants/theme'

interface ButtonProps {
    label: string
    onPress: () => void
    variant?: 'primary' | 'secondary' | 'danger'
    loading?: boolean
    disabled?: boolean
    icon?: ReactNode
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, icon }: ButtonProps) {
    const inactive = Boolean(loading || disabled)
    return (
        <Pressable
            accessibilityRole="button"
            disabled={inactive}
            onPress={onPress}
            style={({ pressed }) => [
                styles.base,
                styles[variant],
                inactive && styles.disabled,
                pressed && !inactive && styles.pressed,
            ]}
        >
            {loading ? <ActivityIndicator color={variant === 'secondary' ? colors.blue : '#FFFFFF'} /> : icon}
            <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
        </Pressable>
    )
}

const styles = StyleSheet.create({
    base: {
        minHeight: 48,
        borderRadius: 12,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    primary: { backgroundColor: colors.blue },
    secondary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
    danger: { backgroundColor: colors.danger },
    label: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    secondaryLabel: { color: colors.blue },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.82 },
})
