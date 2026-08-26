import { Redirect } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { colors } from '@/constants/theme'
import { useSession } from '@/context/SessionContext'

export default function Index() {
    const { session, loading } = useSession()

    if (loading) {
        return <View style={styles.loading}><ActivityIndicator color={colors.blue} size="large" /></View>
    }

    return <Redirect href={session ? '/(app)' : '/login'} />
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } })
