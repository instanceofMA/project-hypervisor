// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require("http");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parse } = require("url");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const next = require("next");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");

const dev = false; // Force strict high-performance production mode
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

const socketPath = process.env.PORT; // Reads your ~/.sockets/home.sock path

if (!socketPath) {
    console.error(
        "Error: Environment variable 'PORT' must specify a valid socket path.",
    );
    process.exit(1);
}

app.prepare().then(() => {
    // 1. Wipe the old socket file if it exists from a previous crash/run
    if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
    }

    // 2. Start the HTTP server directly on the Unix socket file path
    createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    }).listen(socketPath, () => {
        // 3. Grant proper permissions so Caddy can read/write to the stream
        fs.chmodSync(socketPath, "0666");
        console.log(
            `> Production Next.js Hypervisor ready on socket: ${socketPath}`,
        );
    });
});
