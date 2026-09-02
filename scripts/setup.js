/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║       PROJECT HYPERVISOR — MASTER ENVIRONMENT SETUP        ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// 1. Resolve true non-root user details even if executed under sudo
const getRealUser = () => {
    if (process.env.SUDO_USER) {
        const username = process.env.SUDO_USER;
        const uid = execSync(`id -u "${username}"`, {
            encoding: "utf8",
        }).trim();
        return {
            username,
            uid,
            homeDir: `/Users/${username}`,
        };
    }
    return {
        username: os.userInfo().username,
        uid: process.getuid().toString(),
        homeDir: os.homedir(),
    };
};

const user = getRealUser();
const projectDir = path.resolve(__dirname, "..");
const scriptsDir = path.join(user.homeDir, ".scripts");
const socketsDir = path.join(user.homeDir, ".sockets");
const zshrcPath = path.join(user.homeDir, ".zshrc");

console.log(`👤 Target User: ${user.username} (UID: ${user.uid})`);
console.log(`📂 Home Directory: ${user.homeDir}`);
console.log(`📁 Project Directory: ${projectDir}\n`);

// 2. Ensure system directories exist with non-restrictive permissions (0755)
console.log("⚙️ Step 1: Setting up directories (~/.sockets and ~/.scripts)...");
if (!fs.existsSync(socketsDir))
    fs.mkdirSync(socketsDir, { recursive: true, mode: 0o755 });
fs.chmodSync(socketsDir, 0o755);

if (!fs.existsSync(scriptsDir))
    fs.mkdirSync(scriptsDir, { recursive: true, mode: 0o755 });
fs.chmodSync(scriptsDir, 0o755);
console.log("✅ Directories ready.\n");

// 3. Deploy CLI Scripts (~/.scripts/phv.sh & ~/.scripts/hypervisor.js)
console.log("⚙️ Step 2: Deploying global CLI orchestrator...");
const srcPhv = path.join(__dirname, "phv.sh");
const destPhv = path.join(scriptsDir, "phv.sh");
fs.copyFileSync(srcPhv, destPhv);
fs.chmodSync(destPhv, 0o755);

const srcHypervisor = path.join(__dirname, "hypervisor.js");
const destHypervisor = path.join(scriptsDir, "hypervisor.js");
fs.copyFileSync(srcHypervisor, destHypervisor);
fs.chmodSync(destHypervisor, 0o755);
console.log(`✅ Deployed phv.sh & hypervisor.js to ${scriptsDir}\n`);

// 4. Update ~/.zshrc idempotently
console.log("⚙️ Step 3: Checking shell configuration (~/.zshrc)...");
const zshrcSourceLine = "source ~/.scripts/phv.sh";
let zshrcContent = fs.existsSync(zshrcPath)
    ? fs.readFileSync(zshrcPath, "utf8")
    : "";

if (!zshrcContent.includes("~/.scripts/phv.sh")) {
    fs.appendFileSync(
        zshrcPath,
        `\n# Project Hypervisor CLI\n${zshrcSourceLine}\n`,
        "utf8",
    );
    console.log('✅ Added "source ~/.scripts/phv.sh" to ~/.zshrc');
} else {
    console.log("✅ ~/.zshrc already contains phv CLI source line.");
}
console.log("");

const README_URL = 'https://github.com/instanceofMA/project-hypervisor#readme';

const showTroubleshootingPrompt = () => {
    console.log('────────────────────────────────────────────────────────────');
    console.log('📖 Need help or prefer manual configuration?');
    console.log(`   Refer to the complete setup guide in README.md:`);
    console.log(`   🔗 ${README_URL}`);
    console.log('────────────────────────────────────────────────────────────\n');
};

// 5. Check /etc/hosts for home.test
console.log('⚙️ Step 4: Checking DNS resolution in /etc/hosts...');
const hostsContent = fs.readFileSync('/etc/hosts', 'utf8');
if (!hostsContent.includes('home.test')) {
    console.log('⚠️ /etc/hosts is missing home.test entry.');
    console.log('👉 Please run this one-time command to map local domains:');
    console.log('\n   sudo sh -c \'echo "\\n127.0.0.1 home.test" >> /etc/hosts\'\n');
    console.log(`📖 See README.md (Section 3: Component A) for more info: ${README_URL}\n`);
} else {
    console.log('✅ /etc/hosts already contains home.test mapping.\n');
}

// 6. Check Caddy Installation
console.log('⚙️ Step 5: Checking Caddy Gateway installation...');
try {
    const caddyPath = execSync('which caddy', { encoding: 'utf8' }).trim();
    console.log(`✅ Caddy binary found: ${caddyPath}\n`);
} catch {
    console.log('⚠️ Caddy not found on PATH. To install Caddy:');
    console.log('   brew install caddy\n');
    console.log(`📖 See README.md (Section 3: Component B) for full Caddy setup: ${README_URL}\n`);
}

// 7. Compile Next.js Production Build
console.log('⚙️ Step 6: Building Next.js Dashboard for Production...');
try {
    execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });
    console.log('✅ Production build complete.\n');
} catch (err) {
    console.error('\n❌ Build failed:', err.message);
    showTroubleshootingPrompt();
    process.exit(1);
}

// 8. Register and Start LaunchAgent Daemon
console.log('⚙️ Step 7: Registering and Starting LaunchAgent Daemon...');
try {
    execSync('node scripts/daemon.js install', {
        cwd: projectDir,
        stdio: 'inherit',
    });
    console.log(
        '\n🎉 Setup Complete! Your Project Hypervisor is live at https://home.test',
    );
    console.log(
        '👉 To enable the `phv` command in your current terminal session, run: source ~/.zshrc\n',
    );
} catch (err) {
    console.error('\n❌ Daemon registration failed:', err.message);
    showTroubleshootingPrompt();
}
