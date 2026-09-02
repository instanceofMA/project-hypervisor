const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

const resolvePreScripts = (cmdString) =>
    cmdString
        .split('&&')
        .map(segment => segment.trim())
        .filter(segment => segment && !segment.startsWith('next '));

const normalizeCommand = (scriptText) =>
    scriptText.startsWith('npm ') || scriptText.startsWith('npx ') 
        ? scriptText 
        : `npm run ${scriptText.split(' ')}`;

const initializeNextServer = async (socketPath) => {
    try {
        const nextModulePath = require.resolve('next', { paths: [process.cwd()] });
        const next = require(nextModulePath);
        const app = next({ dev: true, dir: process.cwd() });
        const handle = app.getRequestHandler();
        
        await app.prepare();
        
        if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);

        http.createServer((req, res) => handle(req, res, url.parse(req.url, true)))
            .listen(socketPath, () => {
                fs.chmodSync(socketPath, '0666'); // Critical permission step for Caddy access
                console.log(`▲ Next.js Local Gateway Server ready and readable on socket: ${socketPath}`);
            });
    } catch (error) {
        console.error('❌ Next.js Programmatic API Initialization Failed:', error.message);
        process.exit(1);
    }
};

const orchestrateDevelopmentMatrix = async () => {
    const socketPath = process.env.PORT;
    if (!socketPath) {
        console.error("❌ Error: PORT environment variable tracking a socket file is missing.");
        process.exit(1);
    }

    const pkgPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) {
        console.log('⚠️ No package.json detected. Spawning raw fallback engine layers...');
        return initializeNextServer(socketPath);
    }

    let pkg = {};
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (err) {
        console.error('⚠️ Could not parse package.json:', err.message);
    }

    const devCommand = pkg.scripts?.dev || '';
    
    resolvePreScripts(devCommand)
        .map(normalizeCommand)
        .forEach(cmd => {
            console.log(`📦 Executing pipeline task: ${cmd}`);
            try { execSync(cmd, { stdio: 'inherit' }); } catch { process.exit(1); }
        });

    return initializeNextServer(socketPath);
};

orchestrateDevelopmentMatrix();
