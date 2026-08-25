import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ReportsProvider } from '@/context/ReportsContext'
import { SessionProvider } from '@/context/SessionContext'
import { colors } from '@/constants/theme'

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <SessionProvider>
                    <ReportsProvider>
                        <StatusBar style="dark" />
                        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
                    </ReportsProvider>
                </SessionProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    )
}
