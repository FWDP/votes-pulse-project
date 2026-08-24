import {
    useEffect,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react'

import type { ElectionSelection } from '../types/elections'
import {
    applyElectionSelectionToSearch,
    createElectionSelection,
    parseElectionSelection,
} from '../utils/elections'

export const usePersistedElectionSelection = (
    enabled = true,
): [ElectionSelection, Dispatch<SetStateAction<ElectionSelection>>] => {
    const [selection, setSelection] = useState<ElectionSelection>(() => {
        if (typeof window === 'undefined') return createElectionSelection()
        return parseElectionSelection(window.location.search)
    })

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return

        const nextSearch = applyElectionSelectionToSearch(
            window.location.search,
            selection,
        )
        if (nextSearch !== window.location.search) {
            window.history.replaceState(
                window.history.state,
                '',
                `${window.location.pathname}${nextSearch}${window.location.hash}`,
            )
        }
    }, [enabled, selection])

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') return

        const handlePopState = () => {
            setSelection(parseElectionSelection(window.location.search))
        }
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [enabled])

    return [selection, setSelection]
}
