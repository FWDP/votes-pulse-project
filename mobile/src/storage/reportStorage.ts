import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FieldReport } from '@/types/fieldReports'

const REPORTS_KEY = 'votes.mobile.field-reports.v1'

export async function loadStoredReports(): Promise<FieldReport[] | null> {
    const value = await AsyncStorage.getItem(REPORTS_KEY)
    if (!value) return null

    try {
        const reports = JSON.parse(value) as FieldReport[]
        return Array.isArray(reports) ? reports : null
    } catch {
        await AsyncStorage.removeItem(REPORTS_KEY)
        return null
    }
}

export const storeReports = (reports: FieldReport[]) =>
    AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports))
