import { Redirect } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { FormField } from '@/components/FormField'
import { Screen } from '@/components/Screen'
import { colors } from '@/constants/theme'
import { useSession } from '@/context/SessionContext'

export default function LoginScreen() {
    const { session, signIn } = useSession()
    const [email, setEmail] = useState('field@example.test')
    const [password, setPassword] = useState('prototype')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    if (session) return <Redirect href="/(app)" />

    const submit = async () => {
        setLoading(true)
        setError('')
        try {
            await signIn(email, password)
        } catch (signInError) {
            setError(signInError instanceof Error ? signInError.message : 'Unable to sign in.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Screen scroll={false}>
                <View style={styles.hero}>
                    <View style={styles.mark}><Text style={styles.markText}>V</Text></View>
                    <Text style={styles.brand}>VOTES</Text>
                    <Text style={styles.product}>Field Reports</Text>
                    <Text style={styles.copy}>Capture verified observations from the field and send them to the VOTES Web App.</Text>
                </View>
                <View style={styles.formCard}>
                    <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                    <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    <Button label="Sign in" onPress={() => void submit()} loading={loading} />
                    <Text style={styles.prototype}>Prototype mode uses the prefilled credentials when no API URL is configured.</Text>
                </View>
            </Screen>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    hero: { flex: 1, minHeight: 260, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    mark: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    markText: { color: '#F8C73A', fontSize: 30, fontWeight: '900' },
    brand: { color: colors.navy, fontSize: 28, fontWeight: '900', letterSpacing: 2 },
    product: { color: colors.blue, fontSize: 15, fontWeight: '800', marginTop: 2 },
    copy: { color: colors.muted, textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 12, maxWidth: 320 },
    formCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18, gap: 15 },
    error: { color: colors.danger, fontSize: 12 },
    prototype: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center' },
})
