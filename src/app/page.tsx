"use client";

import {
    ExternalLink,
    Radio,
    ShieldAlert,
    Cpu,
    Terminal,
    HelpCircle,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { AppStatus } from "./api/matrix/route";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useMatrixStream } from "@/hooks/useMatrixStream";

// Pure Component: Status Badge deriving presentation directly from props
const StatusBadge = ({
    isAlive,
    hasSocket,
}: {
    isAlive: boolean;
    hasSocket: boolean;
}) => {
    const styles = isAlive
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        : hasSocket
          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
          : "bg-slate-800 text-slate-400 border-slate-700";

    const label = isAlive ? "Online" : hasSocket ? "Idle" : "Offline";

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles}`}
        >
            <Radio
                className={`w-3.5 h-3.5 ${isAlive ? "animate-pulse" : ""}`}
            />
            {label}
        </span>
    );
};

// Pure Component: Application Card
const ProjectCard = ({ app }: { app: AppStatus }) => (
    <div className="group relative bg-slate-900 border border-slate-800 rounded-xl p-6 transition-all duration-300 hover:border-slate-700 hover:shadow-2xl hover:shadow-indigo-500/5 hover:-translate-y-0.5">
        <div className="flex justify-between items-start mb-4">
            <a
                href={`https://${app.domain}`}
                target="_blank"
                rel="noreferrer"
                className="text-lg font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors flex items-center gap-1.5 tracking-tight"
            >
                {app.domain}
                <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
            </a>
            <StatusBadge isAlive={app.isAlive} hasSocket={app.hasSocket} />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800/60">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-1 font-bold">
                Data Socket Stream Path
            </p>
            <div className="text-xs font-mono bg-slate-950 px-3 py-2 rounded-md text-slate-400 select-all overflow-x-auto whitespace-nowrap scrollbar-none border border-slate-800/40">
                {app.socketPath}
            </div>
        </div>
    </div>
);

// Pure Component: Collapsible System Architecture Manual
const SystemManual = ({
    isOpen,
    onToggle,
}: {
    isOpen: boolean;
    onToggle: () => void;
}) => (
    <section className="bg-slate-900/40 border border-slate-800/80 rounded-xl shadow-xl overflow-hidden">
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-900/80 transition-colors focus:outline-none"
        >
            <div className="flex gap-3 items-center">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                    <HelpCircle className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-200">
                        System Architecture Manual
                    </h2>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                        Read Me (Future Self)
                    </span>
                </div>
            </div>
            <div className="text-slate-400 hover:text-white transition-colors">
                {isOpen ? (
                    <ChevronUp className="w-4 h-4" />
                ) : (
                    <ChevronDown className="w-4 h-4" />
                )}
            </div>
        </button>

        {isOpen && (
            <div className="px-5 pb-6 pt-1 border-t border-slate-800/40 relative">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none select-none">
                    <Terminal className="w-24 h-24 text-indigo-500" />
                </div>
                <div className="max-w-4xl space-y-4">
                    <p className="text-sm text-slate-400 leading-relaxed">
                        Back in 2026, you migrated from{" "}
                        <code className="text-xs bg-slate-950 px-1 py-0.5 rounded text-indigo-300">
                            localhost:PORT
                        </code>{" "}
                        to full subdomains to mirror real-world production
                        environments. Using custom domains eliminates{" "}
                        <strong className="text-slate-200 font-semibold">
                            Cross-Origin Resource Sharing (CORS) isolation
                            issues
                        </strong>{" "}
                        between separate repos, forces authentic{" "}
                        <strong className="text-slate-200 font-semibold">
                            Secure/HttpOnly cookie behaviors
                        </strong>{" "}
                        required by modern OAuth/NextAuth libraries, and lets
                        you test{" "}
                        <strong className="text-slate-200 font-semibold">
                            PWA/Web Crypto browser APIs
                        </strong>{" "}
                        that block unencrypted connections—all managed
                        implicitly via Caddy without docker overhead or manual
                        port collisions.
                    </p>

                    <div className="grid gap-4 md:grid-cols-3 text-[11px] font-mono text-slate-400 pt-1">
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/30">
                            <strong className="text-indigo-400 block mb-1">
                                1. The DNS Router
                            </strong>
                            Your Mac&apos;s{" "}
                            <code className="text-slate-300">/etc/hosts</code>{" "}
                            file maps all{" "}
                            <code className="text-slate-300">*.test</code>{" "}
                            domains directly back to loopback interface address{" "}
                            <code className="text-slate-300">127.0.0.1</code>.
                        </div>
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/30">
                            <strong className="text-indigo-400 block mb-1">
                                2. The Gateway (Caddy)
                            </strong>
                            A global background Caddy daemon binds to system
                            ports 80/443, automatically generates native
                            system-trusted SSL certificates, and listens for
                            requests.
                        </div>
                        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/30">
                            <strong className="text-indigo-400 block mb-1">
                                3. The Portless Sockets
                            </strong>
                            Instead of ports, running{" "}
                            <code className="text-slate-300">npm run dev</code>{" "}
                            drops a virtual stream file into{" "}
                            <code className="text-slate-300">~/.sockets/</code>.
                            Caddy tunnels browser traffic straight through these
                            Unix Domain Sockets (UDS) for lightning-fast,
                            collision-free local networking.
                        </div>
                    </div>
                </div>
            </div>
        )}
    </section>
);

// Pure Component: App Grid / Empty / Loading state view
const MatrixView = ({
    apps,
    loading,
}: {
    apps: AppStatus[];
    loading: boolean;
}) => {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-mono tracking-wider">
                    Mapping Hypervisor Environment...
                </p>
            </div>
        );
    }

    if (apps.length === 0) {
        return (
            <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center max-w-md mx-auto">
                <ShieldAlert className="w-10 h-10 text-amber-500/70 mx-auto mb-4" />
                <h3 className="text-white font-medium mb-1">
                    No Applications Registered
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                    Add development domains inside your internal /etc/hosts file
                    to list them here.
                </p>
            </div>
        );
    }

    return (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
                <ProjectCard key={app.domain} app={app} />
            ))}
        </div>
    );
};

export default function Home() {
    const { apps, loading } = useMatrixStream();
    const [isManualOpen, setIsManualOpen] = usePersistentState(
        "hypervisor_manual_expanded",
        true,
    );

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30">
            <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                            <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight text-white">
                                Project Hypervisor
                            </h1>
                            <p className="text-xs text-slate-400 font-mono">
                                Portless Workspace Gateway
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-xs font-mono text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Reverse Proxy Active (Powered by Caddy)
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
                <SystemManual
                    isOpen={isManualOpen}
                    onToggle={() => setIsManualOpen((prev) => !prev)}
                />

                <MatrixView apps={apps} loading={loading} />
            </main>
        </div>
    );
}
