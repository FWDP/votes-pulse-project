import type {
    QuickIssue,
    SourceItem,
} from "../../types/dashboard";

import DataSourcesBreakdown from "./DataSourceBreakdown";
import TopIssuesQuickView from "./TopIssuesQuickview";

interface DataSourcesCardProps {
    sources: SourceItem[];
    quickIssues: QuickIssue[];
    sourcesTitle?: string;
    issuesTitle?: string;
}

export default function DataSourcesCard({
    sources,
    quickIssues,
    sourcesTitle = 'Data Sources Breakdown',
    issuesTitle = 'Top Issues — Quick View',
}: DataSourcesCardProps) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <DataSourcesBreakdown
                data={sources}
                title={sourcesTitle}
            />

            <div className="mt-5">
                <TopIssuesQuickView
                    data={quickIssues}
                    title={issuesTitle}
                />
            </div>
        </div>
    );
}