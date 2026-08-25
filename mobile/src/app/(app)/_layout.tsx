import { Redirect, Tabs } from 'expo-router'
import { Text, type ColorValue } from 'react-native'

import { colors } from '@/constants/theme'
import { useSession } from '@/context/SessionContext'

const tabIcon = (symbol: string, color: ColorValue) => <Text style={{ color, fontSize: 17 }}>{symbol}</Text>

export default function AppLayout() {
    const { session, loading } = useSession()
    if (!loading && !session) return <Redirect href="/login" />

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.blue,
                tabBarInactiveTintColor: colors.muted,
                tabBarStyle: { height: 66, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.border },
                tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
            }}
        >
            <Tabs.Screen name="index" options={{ title: 'Reports', tabBarIcon: ({ color }) => tabIcon('▤', color) }} />
            <Tabs.Screen name="new" options={{ title: 'New report', tabBarIcon: ({ color }) => tabIcon('＋', color) }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => tabIcon('●', color) }} />
            <Tabs.Screen name="reports/[id]" options={{ href: null }} />
        </Tabs>
    )
}
