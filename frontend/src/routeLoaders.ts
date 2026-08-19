export const loadPulseApp = () =>
    import('./PulseApp')

export const loadOverviewPage = () =>
    import('./pages/OverviewPage')

export const loadSentimentPage = () =>
    import('./pages/SentimentPage')

export const loadIssuesPage = () =>
    import('./pages/IssuesPage')

export const loadLocationPage = () =>
    import('./pages/LocationPage')

export const loadTimelinePage = () =>
    import('./pages/TimelinePage')

export const loadHistoricalPage = () =>
    import('./pages/HistoricalPage')

export const loadKeyInsightsPage = () =>
    import('./pages/KeyInsightsPage')

export const loadDataScopePage = () =>
    import('./pages/DataScopePage')

export const loadFieldReportsPage = () =>
    import('./pages/FieldReportsPage')

export const loadRolesPage = () =>
    import('./pages/admin/RolesPage')

export const loadSuperadminsPage = () =>
    import('./pages/admin/SuperadminsPage')

export const loadSessionsPage = () =>
    import('./pages/admin/SessionsPage')

export const loadExportsPage = () =>
    import('./pages/admin/ExportsPage')

const preloadSentiment = async () => {
    const [, geographyApi] = await Promise.all([
        loadSentimentPage(),
        import('./services/geographyApi'),
    ])

    await geographyApi.getRegions()
}

const routePreloaders: Record<
    string,
    () => Promise<unknown>
> = {
    overview: loadOverviewPage,
    sentiment: preloadSentiment,
    issues: loadIssuesPage,
    location: loadLocationPage,
    timeline: loadTimelinePage,
    historical: loadHistoricalPage,
    insights: loadKeyInsightsPage,
    datascope: loadDataScopePage,
    fieldreports: loadFieldReportsPage,
    roles: loadRolesPage,
    superadmins: loadSuperadminsPage,
    sessions: loadSessionsPage,
    exports: loadExportsPage,
}

export const preloadRoute = (
    pathname: string,
): Promise<unknown> => {
    const routeName = pathname
        .split('/')
        .filter(Boolean)
        .at(-1)

    if (!routeName) return loadPulseApp()

    return routePreloaders[routeName]?.() ??
        Promise.resolve()
}
