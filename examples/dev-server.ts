import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const PORT = 3001;

// Helper to determine Content-Type
const getMimeType = (ext: string) => {
    const mimes: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".ts": "application/typescript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
        ".wasm": "application/wasm",
    };
    return mimes[ext] || "text/plain";
};

const server = http.createServer(async (req, res) => {
    const rawUrl = req.url || "/";
    const parsed = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
    const url = parsed.pathname;

    // 1. DASHBOARD: List all folders in /examples
    if (url === "/" || url === "/index.html") {
        const examplesDir = path.join(process.cwd(), "examples");
        const folders = fs
            .readdirSync(examplesDir, { withFileTypes: true })
            .filter((dir) => dir.isDirectory())
            .map(
                (dir) =>
                    `<li><a href="/examples/${dir.name}/index.html">${dir.name.toUpperCase()}</a></li>`,
            )
            .join("");

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
            <h1>🍰 Tiramisu 2.0 - Examples</h1><ul>${folders}</ul></body></html>`);
        return;
    }

    // 2. ON-THE-FLY BUNDLING: If index.html asks for bundle.js or app.js
    if (url.endsWith("bundle.js") || url.endsWith("app.js")) {
        const tsPath = url.replace(".js", ".ts").slice(1); // remove leading slash
        const absoluteTsPath = path.join(process.cwd(), tsPath);

        if (fs.existsSync(absoluteTsPath)) {
            try {
                const result = await build({
                    entryPoints: [absoluteTsPath],
                    bundle: true,
                    write: false,
                    format: "esm",
                    target: "es2022",
                    sourcemap: "inline",
                });
                res.writeHead(200, {
                    "Content-Type": "application/javascript",
                });
                res.end(result.outputFiles[0].text);
                return;
            } catch (err) {
                res.writeHead(500);
                res.end(`Build Error: ${err}`);
                return;
            }
        }
    }

    // 3. STATIC FILES (HTML, Assets, WASM)
    const filePath = path.join(process.cwd(), url);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.writeHead(200, {
            "Content-Type": getMimeType(path.extname(filePath)),
        });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404);
        res.end("Not Found");
    }
});

server.listen(PORT, () => {
    console.log(
        `\x1b[32m%s\x1b[0m`,
        `🍰 Tiramisu Dev Portal running at http://localhost:${PORT}`,
    );
});
