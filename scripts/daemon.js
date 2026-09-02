/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// Determine real user even if mistakenly invoked via sudo
const getRealUser = () => {
    if (process.env.SUDO_USER) {
        return {
            username: process.env.SUDO_USER,
            uid: execSync(`id -u "${process.env.SUDO_USER}"`, {
                encoding: "utf8",
            }).trim(),
            homeDir: `/Users/${process.env.SUDO_USER}`,
        };
    }
    return {
        username: os.userInfo().username,
        uid: process.getuid().toString(),
        homeDir: os.homedir(),
    };
};

const user = getRealUser();
const LABEL = "com.project-hypervisor";
const PROJECT_DIR = path.resolve(__dirname, "..");
const NODE_BIN = process.execPath;
const SOCKET_DIR = path.join(user.homeDir, ".sockets");
const SOCKET_PATH = path.join(SOCKET_DIR, "home.sock");
const LAUNCH_AGENTS_DIR = path.join(user.homeDir, "Library", "LaunchAgents");
const PLIST_PATH = path.join(LAUNCH_AGENTS_DIR, `${LABEL}.plist`);
const OUT_LOG = path.join(PROJECT_DIR, "out.log");
const ERR_LOG = path.join(PROJECT_DIR, "err.log");
const DOMAIN = `gui/${user.uid}`;

const generatePlist = () => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_BIN}</string>
        <string>${path.join(PROJECT_DIR, "server.js")}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PORT</key>
        <string>${SOCKET_PATH}</string>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${OUT_LOG}</string>
    <key>StandardErrorPath</key>
    <string>${ERR_LOG}</string>
</dict>
</plist>`;

const actions = {
    install() {
        if (!fs.existsSync(SOCKET_DIR)) {
            fs.mkdirSync(SOCKET_DIR, { recursive: true, mode: 0o755 });
        }
        if (!fs.existsSync(LAUNCH_AGENTS_DIR)) {
            fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true, mode: 0o755 });
        }

        fs.writeFileSync(PLIST_PATH, generatePlist(), {
            encoding: "utf8",
            mode: 0o644,
        });
        console.log(`✅ Generated LaunchAgent plist at: ${PLIST_PATH}`);

        actions.restart();
    },

    start() {
        try {
            execSync(`launchctl bootstrap ${DOMAIN} "${PLIST_PATH}"`, {
                stdio: "inherit",
            });
            console.log(`🚀 Service started: ${LABEL}`);
        } catch {
            console.log(`⚠️ Service may already be active or needs restart.`);
        }
    },

    stop() {
        try {
            execSync(
                `launchctl bootout ${DOMAIN} "${PLIST_PATH}" 2>/dev/null`,
                { stdio: "inherit" },
            );
            console.log(`🛑 Service stopped: ${LABEL}`);
        } catch {
            console.log(`ℹ️ Service was not active.`);
        }
    },

    restart() {
        try {
            execSync(`launchctl bootout ${DOMAIN} "${PLIST_PATH}" 2>/dev/null`);
        } catch {}
        try {
            execSync(`launchctl bootstrap ${DOMAIN} "${PLIST_PATH}"`);
            console.log(`🔄 Service live: https://home.test`);
        } catch (err) {
            console.error(`❌ Launchctl error:`, err.message);
        }
    },

    status() {
        try {
            const out = execSync(`launchctl list | grep ${LABEL} || true`, {
                encoding: "utf8",
            });
            if (out.trim()) {
                console.log(`🟢 Active PID & Status: ${out.trim()}`);
            } else {
                console.log(`⚪ Service is not currently running.`);
            }
        } catch (err) {
            console.error(err.message);
        }
    },

    uninstall() {
        actions.stop();
        if (fs.existsSync(PLIST_PATH)) {
            fs.unlinkSync(PLIST_PATH);
            console.log(`🗑️ Removed ${PLIST_PATH}`);
        }
    },
};

const command = process.argv[2] || "status";
if (actions[command]) {
    actions[command]();
} else {
    console.log(
        `Usage: node scripts/daemon.js [install|start|stop|restart|status|uninstall]`,
    );
}
