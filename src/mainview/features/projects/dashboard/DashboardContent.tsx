import { Bot, Code2, Database, FileCode } from "lucide-react";
import type { RefObject } from "react";
import type {
    ActivityEvent,
    ActivitySummary,
    GitHubData,
    GitSnapshot,
    Project,
    ProjectStats,
} from "../../../../shared/types.ts";
import GitPage from "../../git/GitPage.tsx";
import GitHubPage from "../../github/GitHubPage.tsx";
import OverviewPage from "../OverviewPage.tsx";
import AIOverview from "./AIOverview.tsx";
import PillDock from "./PillDock.tsx";

interface DashboardContentProps {
    project: Project;
    gitSnapshot?: GitSnapshot | null;
    projectStats?: ProjectStats | null;
    events: ActivityEvent[];
    activitySummary?: ActivitySummary[];
    todayEventCount: number;
    statsLoading?: boolean;
    statsLastUpdated?: string;
    onRefreshStats?: () => void;
    aiRefreshKey?: number;
    onCommitsClick: () => void;
    onGitHubClick: () => void;
    isGitHubAuthenticated: boolean;
    githubData: GitHubData | null | undefined;
    githubLoading: boolean;
    onGitHubSignIn: () => void;
    timelineRef?: RefObject<HTMLDivElement>;
    githubRef?: RefObject<HTMLDivElement>;
}

export default function DashboardContent({
    project,
    gitSnapshot,
    projectStats,
    events,
    activitySummary,
    todayEventCount,
    statsLoading = false,
    statsLastUpdated,
    onRefreshStats,
    aiRefreshKey,
    onCommitsClick,
    onGitHubClick,
    isGitHubAuthenticated,
    githubData,
    githubLoading,
    onGitHubSignIn,
    timelineRef,
    githubRef,
}: DashboardContentProps) {
    const uncommittedFiles = gitSnapshot?.uncommittedFiles ?? [];
    const uncommittedCount = gitSnapshot?.uncommittedCount ?? 0;

    return (
        <main className="flex-1 overflow-y-auto custom-scrollbar">
            {/* ── Floating pill dock ── */}
            <div className="sticky top-0 z-20 flex justify-center pt-5 pb-1">
                <PillDock
                    baseItemSize={34}
                    magnification={50}
                    distance={130}
                    items={[
                        {
                            icon: <Code2 size={16} strokeWidth={2.2} />,
                            label: "Code",
                            isActive: true,
                        },
                        {
                            icon: <Database size={16} strokeWidth={2} />,
                            label: "Resource Vault",
                            disabled: true,
                            separator: true,
                        },
                        {
                            icon: <Bot size={16} strokeWidth={2} />,
                            label: "Warden",
                            disabled: true,
                            separator: true,
                        },
                    ]}
                />
            </div>

            {/* ── CODE content ── */}
            <div className="px-12 pb-12 pt-4 max-w-[1600px] mx-auto">
                <AIOverview
                    project={project}
                    gitSnapshot={gitSnapshot}
                    refreshKey={aiRefreshKey}
                />

                <div className="grid grid-cols-2 gap-8 mt-8">
                    {/* Left — Summary + Local Changes */}
                    <div className="space-y-8">
                        <section>
                            <OverviewPage
                                project={project}
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
                                eventCount={todayEventCount}
                                events={events}
                                activitySummary={activitySummary}
                                isWidget={true}
                                onCommitsClick={onCommitsClick}
                                onGitHubClick={onGitHubClick}
                                isGitHubAuthenticated={isGitHubAuthenticated}
                                githubData={githubData}
                                githubLoading={githubLoading}
                                onGitHubSignIn={onGitHubSignIn}
                                statsLoading={statsLoading}
                                statsLastUpdated={statsLastUpdated}
                                onRefreshStats={onRefreshStats}
                            />
                        </section>

                        {/* Local Changes */}
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-[10px] font-semibold text-mac-secondary uppercase tracking-[0.2em]">
                                    Local Changes
                                </h3>
                                {uncommittedCount > 0 && (
                                    <span className="text-[10px] font-bold bg-mac-accent/15 text-mac-accent px-2 py-0.5 rounded-full">
                                        {uncommittedCount} file
                                        {uncommittedCount !== 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>
                            <div className="bg-mac-surface border border-mac-border rounded-2xl overflow-hidden">
                                {uncommittedFiles.length === 0 ? (
                                    <div className="flex items-center justify-center py-10">
                                        <span className="text-[13px] text-mac-secondary">
                                            Working tree clean
                                        </span>
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-mac-border/50 max-h-60 overflow-y-auto custom-scrollbar">
                                        {uncommittedFiles.map((file) => (
                                            <li
                                                key={file}
                                                className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-mac-hover transition-colors"
                                            >
                                                <FileCode
                                                    size={12}
                                                    className="text-mac-accent shrink-0"
                                                />
                                                <span className="text-[12px] text-mac-text font-mono truncate">
                                                    {file}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right — Commit Graph + PR / Issues */}
                    <div className="space-y-8">
                        <section ref={timelineRef} className="scroll-mt-6">
                            <GitPage
                                gitSnapshot={gitSnapshot}
                                projectStats={projectStats}
                                statsLoading={statsLoading}
                                isWidget={true}
                                section="timeline"
                            />
                        </section>

                        <section ref={githubRef} className="scroll-mt-6">
                            <GitHubPage
                                githubData={githubData}
                                githubLoading={githubLoading}
                                isGitHubAuthenticated={isGitHubAuthenticated}
                                isWidget={true}
                                section="environment"
                            />
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}
