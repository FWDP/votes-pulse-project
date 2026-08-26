import type { ComponentProps } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { colors } from '@/constants/theme'

interface FormFieldProps extends ComponentProps<typeof TextInput> {
    label: string
    error?: string
    hint?: string
}

export function FormField({ label, error, hint, multiline, style, ...props }: FormFieldProps) {
    return (
        <View style={styles.group}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                {...props}
                multiline={multiline}
                placeholderTextColor="#98A2B3"
                style={[styles.input, multiline && styles.multiline, error && styles.inputError, style]}
            />
            {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
    )
}

const styles = StyleSheet.create({
    group: { gap: 7 },
    label: { color: colors.text, fontSize: 12, fontWeight: '700' },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.surface,
        paddingHorizontal: 14,
        color: colors.text,
        fontSize: 14,
    },
    multiline: { minHeight: 128, paddingTop: 13, textAlignVertical: 'top' },
    inputError: { borderColor: colors.danger },
    error: { color: colors.danger, fontSize: 11 },
    hint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
})
