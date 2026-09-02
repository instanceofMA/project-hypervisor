# Local Development Matrix & Project Hypervisor Implementation Manual

A senior-level architectural blueprint for setting up a 100% portless, zero-maintenance, local development ecosystem on macOS (optimized for Apple Silicon mechanics).

---

## 1. Architectural Philosophy: Why Sockets Matter

Standard frontend/full-stack development workflows rely heavily on raw network configurations, specifically hitting local addresses like `http://localhost:3000`, `http://localhost:3001`, and so on. While this works out of the box, it introduces structural problems for complex web engineering:

- **Authentication & Cookie Inconsistencies:** Modern authentication suites (NextAuth.js/Auth.js, OAuth platforms, Clerk, Auth0) handle tracking sessions via strict state cookies. Browsers manage `http://localhost` as a special edge case but restrict cookies flagged with `Secure`, `HttpOnly`, or advanced `SameSite` properties unless they run over strict HTTPS subdomains.
- **Cross-Origin Resource Sharing (CORS) Disconnects:** Juggling a modern microservice mesh or separating your frontend repo from backend nodes across arbitrary port boundaries triggers Cross-Origin Resource Sharing (CORS) security blocks. Mirroring true multi-subdomain pathways isolates origin targets completely.
- **Missing Production Parity:** Production systems operate over strict HTTPS with DNS subdomains. Development over `localhost:PORT` hides architectural edge cases, missing header overrides, and middleware routing gaps until the moment code is merged and pushed to your production infrastructure.
- **Mental Overhead & Resource Collisions:** Forgetting which port you assigned to an older side project three months ago can lead to port collision crashes (`EADDRINUSE`) if you run multiple servers simultaneously.
- **Next.js CLI Port Type Validation:** Next.js's command-line interface (`next dev` and `next start`) strictly validates the `PORT` environment variable. If it detects a text string path instead of a numeric integer, the CLI crashes instantly.

### The Solution: Programmatic Unix Domain Sockets (UDS)

This design entirely removes ports from your ecosystem. Your projects communicate with your reverse proxy via **Unix Domain Sockets**—highly optimized virtual file endpoints generated inside a dedicated, isolated folder (`~/.sockets/`). By moving data processing directly through macOS kernel memory buffers rather than routing up and down your TCP/IP network layers, data throughput increases while port conflicts are fundamentally eliminated.

To bypass Next.js's strict CLI limitation cleanly, we utilize Next.js's official **Programmatic Node.js API** (`require('next')`). By instantiating the compiler engine directly inside a custom JavaScript file wrapper, we bypass the rigid CLI validation rules completely. Next.js can now listen natively to a Unix Domain Socket file stream inside `~/.sockets/`.

---

## ⚡ Quickstart: 1-Command Automated Setup

For a new machine, clone this repository and run the master installer:

```bash
git clone https://github.com/instanceofMA/project-hypervisor.git
cd project-hypervisor
npm install
npm run setup
```

The master setup script automatically:
1. Validates and prepares `~/.sockets/` with correct permissions (`0755`).
2. Deploys the `phv` CLI to `~/.scripts/phv.sh` and sources it inside `~/.zshrc`.
3. Verifies local DNS (`home.test`) and Caddy gateway status.
4. Compiles the production build and registers the background **LaunchAgent daemon** at `https://home.test`.

---

## 🛠️ Managing the Background Service (Daemon)

Control the background Dashboard server with these `npm` commands:

| Command | Description |
| :--- | :--- |
| `npm run service:start` | Boots the `com.project-hypervisor` LaunchAgent |
| `npm run service:stop` | Halts the background service |
| `npm run service:restart` | Hot-restarts the service daemon |
| `npm run service:status` | Shows the active PID and execution health |
| `npm run service:install` | Dynamically writes `~/Library/LaunchAgents/com.project-hypervisor.plist` and registers it |
| `npm run service:uninstall` | Stops the service and removes the LaunchAgent `.plist` |

---

## 📖 Manual Step-by-Step Setup (Fallback & Architecture Reference)

If you prefer to configure everything manually or need to troubleshoot specific components, follow the step-by-step sections below:

To reproduce this system from scratch on a clean machine, execute these installation commands:

```bash
# 1. Install core system daemons via Homebrew
brew install caddy node

# 2. Allocate a persistent home directory folder to house virtual socket streams
mkdir -p ~/.sockets
```

### Why We Use Global Homebrew Node for Background Systems

While you must keep a version manager like **NVM** or **FNM** active inside your Zsh runtime shell tabs for everyday project development, background systems (like the Project Hypervisor Dashboard) require complete environmental isolation. Mapping your system daemons directly to Homebrew's absolute binary paths (`/opt/homebrew/bin/node`) guarantees that your background services remain completely stable, unaffected by any shifting version managers or runtime tab changes.

---

## 3. Core Component Layout & Native macOS Configurations

### Component A: Local Host DNS Mapping (`/etc/hosts`)

Instead of deploying heavy background DNS tools (like `dnsmasq`) which require brittle loopback aliases to function on modern macOS networking versions, you register custom local top-level domains directly in your Mac's internal routing table.

Open the file:

```bash
sudo nano /etc/hosts
```

Append your development projects to a single localhost loopback line:

```text
127.0.0.1 home.test app-one.test app-two.test saas-dashboard.test e-commerce.test docs.test
```

### Component B: The Global Reverse Proxy Infrastructure (`~/.Caddyfile`)

Caddy acts as your local gateway, running securely as a root daemon on ports 80/443. It captures incoming traffic, injects local system-trusted SSL certificates, and tunnels communication smoothly straight down into your target Unix Sockets.

Create your master file:

```bash
nano ~/.Caddyfile
```

Paste this configuration layout (ensure the paths resolve explicitly to your absolute user home directory, replacing `username` with your macOS user account):

```text
{
    # Block Caddy from trying to order public certificates via Let's Encrypt online
    local_certs
}

home.test {
    tls internal
    reverse_proxy unix//Users/username/.sockets/home.sock
}

app-one.test {
    tls internal
    reverse_proxy unix//Users/username/.sockets/app-one.sock
}

app-two.test {
    tls internal
    reverse_proxy unix//Users/username/.sockets/app-two.sock
}

saas-dashboard.test {
    tls internal
    reverse_proxy unix//Users/username/.sockets/saas-dashboard.sock
}

e-commerce.test {
    tls internal
    reverse_proxy unix//Users/username/.sockets/e-commerce.sock
}

docs.test {
    tls internal
    reverse_proxy unix//Users/username/.sockets/docs.sock
}
```

Link this file to Homebrew Caddy's default location, restart the service, and inject the root certificate into your macOS System Keychain:

```bash
sudo ln -sf ~/.Caddyfile /opt/homebrew/etc/Caddyfile
sudo brew services restart caddy
sudo caddy trust
```

---

## 4. The Orchestration Toolchain (100% App-Agnostic)

To keep your repositories clean and protect your Git history from environment-specific scripts, the toolchain is decoupled into two global files inside your `~/.scripts/` folder.

### Component 1: The JavaScript Engine (`~/.scripts/hypervisor.js`)

Create the file:

```bash
mkdir -p ~/.scripts
nano ~/.scripts/hypervisor.js
```

Paste this declarative JavaScript architecture:

```javascript
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");

const resolvePreScripts = (cmdString) =>
    cmdString
        .split("&&")
        .map((segment) => segment.trim())
        .filter((segment) => segment && !segment.startsWith("next "));

const normalizeCommand = (scriptText) =>
    scriptText.startsWith("npm ") || scriptText.startsWith("npx ")
        ? scriptText
        : `npm run ${scriptText.split(" ")}`;

const initializeNextServer = async (socketPath) => {
    try {
        const nextModulePath = require.resolve("next", {
            paths: [process.cwd()],
        });
        const next = require(nextModulePath);
        const app = next({ dev: true, dir: process.cwd() });
        const handle = app.getRequestHandler();

        await app.prepare();

        if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);

        http.createServer((req, res) =>
            handle(req, res, url.parse(req.url, true)),
        ).listen(socketPath, () => {
            fs.chmodSync(socketPath, "0666"); // Critical permission step for Caddy access
            console.log(
                `▲ Next.js Local Gateway Server ready and readable on socket: ${socketPath}`,
            );
        });
    } catch (error) {
        console.error(
            "❌ Next.js Programmatic API Initialization Failed:",
            error.message,
        );
        process.exit(1);
    }
};

const orchestrateDevelopmentMatrix = async () => {
    const socketPath = process.env.PORT;
    if (!socketPath) {
        console.error(
            "❌ Error: PORT environment variable tracking a socket file is missing.",
        );
        process.exit(1);
    }

    const pkgPath = path.join(process.cwd(), "package.json");
    if (!fs.existsSync(pkgPath)) {
        console.log(
            "⚠️ No package.json detected. Spawning raw fallback engine layers...",
        );
        return initializeNextServer(socketPath);
    }

    let pkg = {};
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } catch (err) {
        console.error("⚠️ Could not parse package.json:", err.message);
    }

    const devCommand = pkg.scripts?.dev || "";

    resolvePreScripts(devCommand)
        .map(normalizeCommand)
        .forEach((cmd) => {
            console.log(`📦 Executing pipeline task: ${cmd}`);
            try {
                execSync(cmd, { stdio: "inherit" });
            } catch {
                process.exit(1);
            }
        });

    return initializeNextServer(socketPath);
};

orchestrateDevelopmentMatrix();
```

### Component 2: The Shell Launcher (`~/.scripts/phv.sh`)

Create the file:

```bash
nano ~/.scripts/phv.sh
```

Paste the extensible `phv` CLI script:

```bash
#!/usr/bin/env zsh

phv() {
    local SUBCOMMAND="$1"
    local USERNAME=$(whoami)
    local SOCKETS_DIR="/Users/${USERNAME}/.sockets"

    case "$SUBCOMMAND" in
        dev)
            local DIR_NAME=$(basename "$PWD" | tr '[:upper:]' '[:lower:]')
            local APP_NAME=${2:-$DIR_NAME}
            local SOCKET_PATH="${SOCKETS_DIR}/${APP_NAME}.sock"

            echo "🚀 Hypervisor: Routing workspace matrix context for [${APP_NAME}]..."
            mkdir -p "$SOCKETS_DIR"
            rm -f "$SOCKET_PATH"

            export PORT="$SOCKET_PATH"
            export PATH="./node_modules/.bin:$PATH"

            node "/Users/${USERNAME}/.scripts/hypervisor.js"
            ;;

        status|list)
            echo "📊 Project Hypervisor - Active Sockets:"
            if [ -d "$SOCKETS_DIR" ]; then
                ls -la "$SOCKETS_DIR" | grep '\.sock$' || echo "No active sockets found."
            else
                echo "No sockets directory found at $SOCKETS_DIR"
            fi
            ;;

        clean)
            echo "🧹 Cleaning stale socket files in ${SOCKETS_DIR}..."
            rm -f "${SOCKETS_DIR}"/*.sock
            echo "✅ Sockets directory clean."
            ;;

        restart)
            echo "🔄 Restarting Project Hypervisor LaunchAgent..."
            launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.ma.home.test.plist 2>/dev/null
            launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ma.home.test.plist
            echo "✅ Hypervisor restarted. Visit https://home.test"
            ;;

        help|--help|-h|"")
            echo "╔════════════════════════════════════════════════════════════╗"
            echo "║               PROJECT HYPERVISOR (phv) CLI                 ║"
            echo "╚════════════════════════════════════════════════════════════╝"
            echo ""
            echo "Usage: phv <command> [options]"
            echo ""
            echo "Commands:"
            echo "  phv dev [name]     Launch dev server routed through ~/.sockets/[name].sock"
            echo "  phv status         List active Unix Domain Sockets in ~/.sockets/"
            echo "  phv clean          Remove all stale socket files in ~/.sockets/"
            echo "  phv restart        Restart the main Hypervisor dashboard LaunchAgent"
            echo "  phv help           Show this help message"
            echo ""
            ;;

        *)
            echo "❌ Unknown command: phv $SUBCOMMAND"
            echo "Run 'phv help' for available commands."
            return 1
            ;;
    esac
}

# Alias for backward compatibility
alias dev-domain="phv dev"
```

Make it executable and source it in your `~/.zshrc`:

```bash
chmod +x ~/.scripts/phv.sh
echo "source ~/.scripts/phv.sh" >> ~/.zshrc
source ~/.zshrc
```

---

## 5. The Project Hypervisor Dashboard App Setup

Your dashboard is a clean **Next.js App Router** project configured with **TypeScript, Tailwind CSS, and Lucide Icons**. It resides inside `/Users/username/Projects/home.test`.

### The Core Files

#### 1. Backend Route Scanner (`src/app/api/matrix/route.ts`)

A declarative Route Handler that scans the host layout and determines application status:

```typescript
import { NextResponse } from "next/server";
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import os from "os";

export interface AppStatus {
    domain: string;
    socketPath: string;
    hasSocket: boolean;
    isAlive: boolean;
}

const parseTestDomains = (hostsContent: string): string[] =>
    hostsContent
        .split("
")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("127.0.0.1"))
        .flatMap((line) => line.replace("127.0.0.1", "").trim().split(/\s+/))
        .filter((domain) => domain.endsWith(".test") && domain !== "home.test");

const getActiveSockets = (dirPath: string): string[] =>
    fs.existsSync(dirPath)
        ? fs.readdirSync(dirPath).filter((file) => file.endsWith(".sock"))
        : [];

const checkProcessLiveness = (socketFullPath: string): boolean => {
    try {
        return (execSync(`lsof ${socketFullPath}`, { stdio: "ignore" }), true);
    } catch {
        return false;
    }
};

export async function GET() {
    const SOCKETS_DIR = path.join(os.homedir(), ".sockets");
    const rawHosts = fs.readFileSync("/etc/hosts", "utf8");
    const domains = parseTestDomains(rawHosts);
    const activeSockets = getActiveSockets(SOCKETS_DIR);

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
```

#### 2. The Custom Production Entry Server (`server.js`)

Next.js's default production runner (`next start`) explicitly forces port values to resolve as numeric markers, causing it to reject a string-based Unix Domain Socket pathway. To bypass this restriction in production, we deploy a streamlined custom HTTP server configuration wrapper:

```javascript
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();
const socketPath = process.env.PORT;

if (!socketPath) {
    console.error(
        "Error: Environment variable 'PORT' must point to a socket file.",
    );
    process.exit(1);
}

app.prepare().then(() => {
    if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);

    createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    }).listen(socketPath, () => {
        fs.chmodSync(socketPath, "0666"); // Ensures Caddy can access the stream cleanly
        console.log(
            `> Production Next.js Hypervisor ready on socket: ${socketPath}`,
        );
    });
});
```

#### 3. Native macOS Daemon Orchestration Script

To ensure your dashboard runs as a permanent, zero-resource background service that automatically launches on boot, we mount it directly into macOS's native service management platform, **`launchd`**.

Create your launch file (replace `username` with your macOS user account):

```bash
nano ~/Library/LaunchAgents/com.username.home.test.plist
```

Paste this XML schema:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.2.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.username.home.test</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>/Users/username/Projects/home.test/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/username/Projects/home.test</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>/Users/username/.sockets/home.sock</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/username/Projects/home.test/out.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/username/Projects/home.test/err.log</string>
</dict>
</plist>
```

Activate the service natively:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.username.home.test.plist
```

---

## 6. Security Protocols & Folder Permissions

To shield your Mac from cross-process security risks without leaving your socket directory open via unstable permissions, we enforce strict macOS Access Control Lists (ACLs) to allow only your account and the root Caddy service inside (replace `username` with your macOS user account):

```bash
# 1. Re-lock user folder boundaries back to private defaults
chmod 700 /Users/username
chmod 700 /Users/username/.sockets

# 2. Grant Caddy (running as root) explicit permission to step inside the sockets directory
chmod +a "user:root allow list,add_file,search,read,write,delete" /Users/username
chmod +a "user:root allow list,add_file,add_subdirectory,search,read,write,delete" /Users/username/.sockets
```

---

## 7. Chronological Incident Log & Resolutions

### 🧠 Incident 1: The Volatile Filesystem Trap

- **Symptom:** Sockets initially mapped to `/tmp/` would drop connection vectors or crash after 3 days of repository inactivity.
- **Root Cause:** macOS executes automated script sweeps inside `/tmp/`, purging files that haven't been modified within a rolling 72-hour window. Additionally, Caddy (running as root) ran into App Sandboxing boundaries when trying to access user-owned files inside `/tmp/`.
- **Resolution:** Moved the socket folder into user space at `~/.sockets/`. This keeps it safe from automatic file cleanup routines, and explicit access parameters can be cleanly maintained using standard filesystem permissions.

### 🧠 Incident 2: The Let's Encrypt Identity Rejection (`ERR_SSL_PROTOCOL_ERROR`)

- **Symptom:** Accessing `https://home.test` returned an invalid security handshake notification.
- **Root Cause:** Caddy default settings automatically try to fetch real public SSL certs from Let's Encrypt. Let's Encrypt returns an explicit HTTP 400 error when requested to sign private top-level domains like `.test`.
- **Resolution:** Modified the `.Caddyfile` to use the global `local_certs` instruction block alongside explicit `tls internal` directives for every site. This switches Caddy to its built-in local cryptographic certificate signing engine, completely offline.

### 🧠 Incident 3: The Ghost NVM Pipeline Lock

- **Symptom:** Next.js threw an immediate `HTTP 502 Bad Gateway` error when managed via background processes.
- **Root Cause:** The `launchd` service was configured to call generic Node binaries, but the system environment was running inside an isolated NVM folder path (`~/.nvm/versions/...`). Moving or updating Node versions broke the binary targets, causing the system execution loops to fail silently.
- **Resolution:** Cleaned up brittle symlinks, installed a dedicated system-wide Node engine via Homebrew, and recompiled the dashboard app dependencies using this stable global runtime environment.

### 🧠 Incident 4: The Next.js Production Type Constraint

- **Symptom:** The system error log (`err.log`) repeatedly threw a warning stating: `value from env PORT is invalid... not a non-negative number`.
- **Root Cause:** While Next.js accepts a string-based socket path in development mode (`next dev`), its production server utility requirements (`next start`) enforce a strict type restriction that forces port entries to resolve strictly as numeric integers.
- **Resolution:** Created a custom `server.js` startup script that programmatically instantiates the core HTTP connection pools, completely bypassing Next.js's internal CLI command-line port type validations.

### 🧠 Incident 5: The Turbopack CLI Lock

- **Symptom:** Next.js 15 apps booted via the `--turbopack` flag ignored the `PORT` filesystem variable entirely, fallback routing straight back to network `localhost:3000` and triggering a 502 Bad Gateway.
- **Resolution:** Dropped the `--turbopack` flag during proxy boots. By using the Next.js Programmatic API, compilation shifts seamlessly to the highly compatible Webpack compiler framework natively.

### 🧠 Incident 6: The Subshell Truncation Gap (Exit Code 127)

- **Symptom:** Evaluating chained commands via `exec sh` caused the terminal pane to crash instantly with a command not found warning.
- **Root Cause:** Subshell calls drop out of your rich Zsh shell environment, losing access to NVM Node binary paths.
- **Resolution:** Replaced subshell calls with native Zsh `export` and `eval` pipelines, appending `./node_modules/.bin` to the local path strings on the fly so binaries resolve flawlessly.

---

## 8. Playbook: Onboarding New Apps Natively

When you create a brand-new application repository down the line, follow these steps to integrate it into your portless local routing matrix:

1.  **Map the URL Domain:** Open your hosts file (`sudo nano /etc/hosts`) and append your new domain to your local loopback address line (e.g., `new-project.test`).
2.  **Update the Proxy Matrix:** Open your master config file (`nano ~/.Caddyfile`) and register your new project route (replace `username` with your macOS user account):
    ```text
    new-project.test {
        tls internal
        reverse_proxy unix//Users/username/.sockets/new-project.sock
    }
    ```
3.  **Hot-Reload Caddy:** Refresh your background configuration maps instantly without restarting your active environments:
    ```bash
    sudo caddy reload --config ~/.Caddyfile
    ```
4.  **Configure the Local App Repository:** Navigate into your new application's codebase folder and create or open your local development environment file:
    ```bash
    nano .env.development.local
    ```
    Add this single line to route its dev server through your socket path structure (replace `username` with your macOS user account):
    ```text
    PORT=/Users/username/.sockets/new-project.sock
    ```
5.  **Launch Your Project Natively:** Run your development server using the global `phv` CLI from inside your project folder:
    ```bash
    phv dev
    ```
    _(Alternatively, you can still use the `dev-domain` alias or start your development server directly)._

Open your browser and navigate straight to `https://new-project.test`. Your new app will immediately resolve securely over an encrypted, portless connection, and its status card on your master `https://home.test` dashboard will instantly flash **Online**.
