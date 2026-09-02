import { NextResponse } from "next/server";
import fs from "fs";
import { execSync } from "child_process";
import path from "path";

export interface AppStatus {
    domain: string;
    socketPath: string;
    hasSocket: boolean;
    isAlive: boolean;
}

// Pure helper function: Extracts valid .test domains from raw /etc/hosts content
const parseTestDomains = (hostsContent: string): string[] =>
    hostsContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("127.0.0.1"))
        .flatMap((line) => line.replace("127.0.0.1", "").trim().split(/\s+/))
        .filter((domain) => domain.endsWith(".test") && domain !== "home.test");

// Pure helper function: Retrieves all socket filenames inside the hidden UDS directory
const getActiveSockets = (dirPath: string): string[] =>
    fs.existsSync(dirPath)
        ? fs.readdirSync(dirPath).filter((file) => file.endsWith(".sock"))
        : [];

// Pure helper function: Checks system process states (lsof) declaratively without throw side-effects
const checkProcessLiveness = (socketFullPath: string): boolean => {
    try {
        return (execSync(`lsof ${socketFullPath}`, { stdio: "ignore" }), true);
    } catch {
        return false;
    }
};

export async function GET() {
    const SOCKETS_DIR = "/Users/ma/.sockets";

    // Read data inputs safely using expressions instead of procedural block initializations
    const rawHosts = fs.readFileSync("/etc/hosts", "utf8");
    const domains = parseTestDomains(rawHosts);
    const activeSockets = getActiveSockets(SOCKETS_DIR);

    // Declarative Mapping Transformation Matrix
    const apps: AppStatus[] = domains.map((domain): AppStatus => {
        const expectedSockName = `${domain.replace(".test", "")}.sock`;
        const fullSocketPath = path.join(SOCKETS_DIR, expectedSockName);
        const hasSocket = activeSockets.includes(expectedSockName);
        const isAlive = hasSocket && checkProcessLiveness(fullSocketPath);

        return {
            domain,
            socketPath: `unix/${fullSocketPath}`,
            hasSocket,
            isAlive,
        };
    });

    return NextResponse.json({ apps });
}
