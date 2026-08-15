import type {
    QuickIssue,
    SourceItem,
} from "../../types/dashboard";

import DataSourcesBreakdown from "./DataSourceBreakdown";
import TopIssuesQuickView from "./TopIssuesQuickview";

interface DataSourcesCardProps {
    sources: SourceItem[];

    quickIssues: QuickIssue[];
}

export default function DataSourcesCard({
    sources,

    quickIssues,
}: DataSourcesCardProps) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
            <DataSourcesBreakdown
                data={sources}
            />

            <div className="mt-5">
                <TopIssuesQuickView
                    data={quickIssues}
                />
            </div>
        </div>
    );
}