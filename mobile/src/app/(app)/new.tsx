import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'

import { Button } from '@/components/Button'
import { FormField } from '@/components/FormField'
import { Screen } from '@/components/Screen'
import { colors, reportTopics } from '@/constants/theme'
import { useReports } from '@/context/ReportsContext'
import { useSession } from '@/context/SessionContext'
import { isApiConfigured } from '@/services/apiClient'
import { listFieldReportRecipients } from '@/services/fieldReportsApi'
import type {
    FieldReportAttachment,
    FieldReportEvidenceType,
    FieldReportLocation,
    FieldReportRecipient,
    FieldReportSeverity,
} from '@/types/fieldReports'

const severityOptions: FieldReportSeverity[] = ['low', 'medium', 'high', 'critical']
const evidenceOptions: FieldReportEvidenceType[] = ['photo', 'interview', 'survey', 'document', 'other']

const makeAttachment = (asset: ImagePicker.ImagePickerAsset): FieldReportAttachment => ({
    id: `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: 'image',
    name: asset.fileName ?? `field-evidence-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize,
    localUri: asset.uri,
    uploadStatus: 'local',
})

export default function NewReportScreen() {
    const { saveReport } = useReports()
    const { session } = useSession()
    const [title, setTitle] = useState('')
    const [observation, setObservation] = useState('')
    const [topic, setTopic] = useState<string>(reportTopics[0])
    const [severity, setSeverity] = useState<FieldReportSeverity>('medium')
    const [evidenceType, setEvidenceType] = useState<FieldReportEvidenceType>('photo')
    const [location, setLocation] = useState<FieldReportLocation>({
        label: session?.user.coverageLabel ?? 'Assigned field coverage',
        localityType: session?.user.localityType,
        regionCode: session?.user.regionCode,
        regionName: session?.user.regionName,
        provinceCode: session?.user.provinceCode,
        provinceName: session?.user.provinceName,
        localityCode: session?.user.coverageCode,
        localityName: session?.user.localityName,
    })
    const [attachments, setAttachments] = useState<FieldReportAttachment[]>([])
    const [recipients, setRecipients] = useState<FieldReportRecipient[]>([])
    const [recipient, setRecipient] = useState<FieldReportRecipient | undefined>()
    const [recipientsLoading, setRecipientsLoading] = useState(Boolean(session && isApiConfigured))
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const locationSummary = useMemo(() => {
        if (!location.coordinates) return 'GPS not captured'
        return `${location.coordinates.latitude.toFixed(5)}, ${location.coordinates.longitude.toFixed(5)}`
    }, [location.coordinates])

    useEffect(() => {
        if (!session || !isApiConfigured) return
        let active = true
        void listFieldReportRecipients(session.token)
            .then(response => {
                if (!active) return
                setRecipients(response.data)
                if (response.data.length === 1) setRecipient(response.data[0])
            })
            .catch(error => {
                if (active) setErrors(current => ({
                    ...current,
                    recipient: error instanceof Error ? error.message : 'Unable to load recipient accounts.',
                }))
            })
            .finally(() => {
                if (active) setRecipientsLoading(false)
            })
        return () => { active = false }
    }, [session])

    const addAsset = (asset?: ImagePicker.ImagePickerAsset) => {
        if (asset) setAttachments(current => [...current, makeAttachment(asset)])
    }

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission.granted) {
            Alert.alert('Camera permission required', 'Enable camera access to capture field evidence.')
            return
        }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 })
        if (!result.canceled) addAsset(result.assets[0])
    }

    const choosePhoto = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!permission.granted) {
            Alert.alert('Photo permission required', 'Enable photo access to attach existing evidence.')
            return
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 })
        if (!result.canceled) addAsset(result.assets[0])
    }

    const captureLocation = async () => {
        const permission = await Location.requestForegroundPermissionsAsync()
        if (!permission.granted) {
            Alert.alert('Location permission required', 'Enable location access to geotag this field report.')
            return
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setLocation(current => ({
            ...current,
            coordinates: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracyMeters: position.coords.accuracy ?? undefined,
                capturedAt: new Date(position.timestamp).toISOString(),
            },
        }))
    }

    const persist = async (intent: 'draft' | 'submit') => {
        const nextErrors: Record<string, string> = {}
        if (!title.trim()) nextErrors.title = 'Enter a short report title.'
        if (!observation.trim()) nextErrors.observation = 'Describe the field observation.'
        if (!location.label.trim()) nextErrors.location = 'Enter the observed location.'
        if (isApiConfigured && !recipient) nextErrors.recipient = 'Select the web account that should receive this report.'
        setErrors(nextErrors)
        if (Object.keys(nextErrors).length) return

        setSaving(true)
        try {
            const report = await saveReport({
                title: title.trim(),
                observation: observation.trim(),
                topic,
                severity,
                evidenceType,
                location: { ...location, label: location.label.trim() },
                recipient,
                attachments,
                occurredAt: new Date().toISOString(),
            }, intent)
            router.replace({ pathname: '/(app)/reports/[id]', params: { id: report.id } })
        } catch (error) {
            Alert.alert('Unable to save report', error instanceof Error ? error.message : 'Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Screen title="New Field Report" subtitle="Record consent-safe observations and supporting evidence.">
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Observation</Text>
                <FormField label="Report title" value={title} onChangeText={setTitle} placeholder="Summarize what happened" error={errors.title} />
                <FormField label="Details" value={observation} onChangeText={setObservation} multiline placeholder="Describe what you observed, who was affected, and relevant context" error={errors.observation} />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Classification</Text>
                <Text style={styles.fieldLabel}>Topic</Text>
                <View style={styles.optionWrap}>{reportTopics.map(item => <Choice key={item} label={item} selected={topic === item} onPress={() => setTopic(item)} />)}</View>
                <Text style={styles.fieldLabel}>Severity</Text>
                <View style={styles.optionWrap}>{severityOptions.map(item => <Choice key={item} label={item} selected={severity === item} onPress={() => setSeverity(item)} />)}</View>
                <Text style={styles.fieldLabel}>Primary evidence</Text>
                <View style={styles.optionWrap}>{evidenceOptions.map(item => <Choice key={item} label={item} selected={evidenceType === item} onPress={() => setEvidenceType(item)} />)}</View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Send to web account</Text>
                <Text style={styles.locationText}>{recipientsLoading ? 'Loading authorized accounts…' : 'Choose who should receive and review this report in the VOTES Web App.'}</Text>
                <View style={styles.optionWrap}>
                    {recipients.map(item => (
                        <Choice
                            key={item.id}
                            label={item.displayName}
                            selected={recipient?.id === item.id}
                            onPress={() => {
                                setRecipient(item)
                                setErrors(current => ({ ...current, recipient: '' }))
                            }}
                        />
                    ))}
                </View>
                {errors.recipient ? <Text style={styles.errorText}>{errors.recipient}</Text> : null}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Location</Text>
                <FormField label="Location label" value={location.label} onChangeText={label => setLocation(current => ({ ...current, label }))} error={errors.location} />
                <Text style={styles.locationText}>{locationSummary}</Text>
                <Button label={location.coordinates ? 'Refresh GPS location' : 'Capture GPS location'} variant="secondary" onPress={() => void captureLocation()} />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Evidence</Text>
                <View style={styles.buttonRow}>
                    <View style={styles.buttonCell}><Button label="Take photo" variant="secondary" onPress={() => void takePhoto()} /></View>
                    <View style={styles.buttonCell}><Button label="Choose photo" variant="secondary" onPress={() => void choosePhoto()} /></View>
                </View>
                {attachments.map(attachment => (
                    <View key={attachment.id} style={styles.attachment}>
                        {attachment.localUri && <Image source={{ uri: attachment.localUri }} style={styles.thumbnail} />}
                        <View style={styles.attachmentCopy}><Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text><Text style={styles.attachmentMeta}>Stored locally until submission</Text></View>
                        <Pressable onPress={() => setAttachments(current => current.filter(item => item.id !== attachment.id))}><Text style={styles.remove}>Remove</Text></Pressable>
                    </View>
                ))}
            </View>

            <View style={styles.submitRow}>
                <View style={styles.buttonCell}><Button label="Save draft" variant="secondary" disabled={saving} onPress={() => void persist('draft')} /></View>
                <View style={styles.buttonCell}><Button label="Submit report" loading={saving} onPress={() => void persist('submit')} /></View>
            </View>
        </Screen>
    )
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
    return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceActive]}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text></Pressable>
}

const styles = StyleSheet.create({
    section: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
    sectionTitle: { color: colors.navy, fontSize: 15, fontWeight: '800' },
    fieldLabel: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
    optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
    choiceActive: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
    choiceText: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    choiceTextActive: { color: colors.blue },
    locationText: { color: colors.muted, fontSize: 11 },
    buttonRow: { flexDirection: 'row', gap: 9 },
    submitRow: { flexDirection: 'row', gap: 9, paddingBottom: 16 },
    buttonCell: { flex: 1 },
    attachment: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
    thumbnail: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.background },
    attachmentCopy: { flex: 1 },
    attachmentName: { color: colors.text, fontSize: 12, fontWeight: '700' },
    attachmentMeta: { color: colors.muted, fontSize: 9, marginTop: 2 },
    remove: { color: colors.danger, fontSize: 10, fontWeight: '700' },
    errorText: { color: colors.danger, fontSize: 11 },
})
