import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { Tiramisu } from "../src/Tiramisu.js";

const PORT = 3001;
const renderJobs = new Map<
    string,
    {
        status: "running" | "done" | "failed";
        percent: number;
        outputPath?: string;
        tempFiles?: string[];
        error?: string;
    }
>();

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

    const readJsonBody = async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks).toString("utf-8").trim();
        if (!raw) return {};
        return JSON.parse(raw);
    };

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

    // 1.5 SERVER EXPORT (Canvas approximation for WebGL Editor Next)
    if (url === "/api/export-canvas") {
        if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "text/plain" });
            res.end("Method Not Allowed");
            return;
        }

        try {
            const body = await readJsonBody();
            let width = 1280;
            let height = 720;
            let duration = 5;
            let fps = 30;

            if (body?.resolution) {
                const [w, h] = String(body.resolution).split("x").map(Number);
                if (Number.isFinite(w) && Number.isFinite(h)) {
                    width = w;
                    height = h;
                }
            } else {
                if (Number.isFinite(body?.width)) width = Number(body.width);
                if (Number.isFinite(body?.height)) height = Number(body.height);
            }
            if (Number.isFinite(body?.duration)) duration = Number(body.duration);
            if (Number.isFinite(body?.fps)) fps = Number(body.fps);

            const outputName = `export_${Date.now()}.mp4`;
            const outputPath = path.join(process.cwd(), outputName);
            const tempFiles: string[] = [];

            console.log(
                `🎬 Export request: ${width}x${height} @ ${fps}fps for ${duration}s`,
            );

            const sources = Array.isArray(body?.sources) ? body.sources : [];
            const resolvedSources: Array<{ path: string } | null> = [];
            for (const source of sources) {
                if (!source) {
                    resolvedSources.push(null);
                    continue;
                }
                if (source.kind === "file" && source.data && source.name) {
                    const safeName = source.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                    const tempName = `upload_${Date.now()}_${safeName}`;
                    const tempPath = path.join(process.cwd(), tempName);
                    const buffer = Buffer.from(source.data, "base64");
                    fs.writeFileSync(tempPath, buffer);
                    tempFiles.push(tempPath);
                    resolvedSources.push({ path: `/${tempName}` });
                    continue;
                }
                if (source.kind === "url" && source.url) {
                    const safeName = `remote_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
                    const tempPath = path.join(process.cwd(), safeName);
                    const resp = await fetch(source.url);
                    if (!resp.ok) {
                        throw new Error(`Failed to download source: ${source.url}`);
                    }
                    const buffer = Buffer.from(await resp.arrayBuffer());
                    fs.writeFileSync(tempPath, buffer);
                    tempFiles.push(tempPath);
                    resolvedSources.push({ path: `/${safeName}` });
                    continue;
                }
                resolvedSources.push(null);
            }

            const clips = Array.isArray(body?.clips) ? body.clips : [];
            const videoPaths = resolvedSources
                .map((s) => (s ? s.path : null))
                .filter(Boolean) as string[];

            const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            renderJobs.set(jobId, {
                status: "running",
                percent: 0,
                outputPath,
                tempFiles,
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ jobId }));

            void (async () => {
                try {
                    const engine = new Tiramisu({
                        width,
                        height,
                        fps,
                        durationSeconds: duration,
                        outputFile: outputPath,
                        videos: videoPaths,
                        data: {
                            clips,
                            sources: resolvedSources,
                            screen: body?.screen,
                            useVideoElement: true,
                        },
                    });

                    engine.addClip(0, duration, ({ ctx, width, height, frame, fps, data, videos, utils }) => {
                        ctx.clearRect(0, 0, width, height);
                        ctx.fillStyle = "black";
                        ctx.fillRect(0, 0, width, height);

                        const time = frame / fps;
                        const layers = Array.isArray(data?.clips) ? data.clips : [];
                        const sources = Array.isArray(data?.sources) ? data.sources : [];
                        const screen = utils.normalizeScreen(data?.screen, { width, height });

                        layers.forEach((clip: any, index: number) => {
                            if (!clip) return;
                            const start = Number(clip.start || 0);
                            const end = start + Number(clip.duration || 0);
                            if (time < start || time > end) return;
                            const source = sources[index];
                            if (!source || !source.path) return;
                            const video = videos[source.path];
                            if (!video) return;

                            const opacity = Number(clip.opacity ?? 1);
                            const sourceWidth = Number(video.videoWidth || width);
                            const sourceHeight = Number(video.videoHeight || height);
                            const rect = utils.computeCanvasDrawRect({
                                clip,
                                screen,
                                sourceWidth,
                                sourceHeight,
                            });
                            const brightness = Number(clip.brightness ?? 0);
                            const contrast = Number(clip.contrast ?? 1);
                            const saturation = Number(clip.saturation ?? 1);

                            const brightnessFactor = Math.max(0, 1 + brightness);
                            const contrastFactor = Math.max(0, contrast);
                            const saturationFactor = Math.max(0, saturation);

                            ctx.save();
                            ctx.globalAlpha = opacity;
                            ctx.translate(rect.centerX, rect.centerY);
                            ctx.rotate(rect.rotate);
                            ctx.filter = `brightness(${brightnessFactor}) contrast(${contrastFactor}) saturate(${saturationFactor})`;
                            ctx.drawImage(
                                video,
                                -rect.drawWidth / 2,
                                -rect.drawHeight / 2,
                                rect.drawWidth,
                                rect.drawHeight,
                            );
                            ctx.restore();
                        });
                    }, 0);

                    await engine.render((progress) => {
                        renderJobs.set(jobId, {
                            status: "running",
                            percent: progress.percent,
                            outputPath,
                            tempFiles,
                        });
                    });

                    renderJobs.set(jobId, {
                        status: "done",
                        percent: 100,
                        outputPath,
                        tempFiles,
                    });
                } catch (err) {
                    renderJobs.set(jobId, {
                        status: "failed",
                        percent: 0,
                        outputPath,
                        tempFiles,
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            })();

            return;
        } catch (err) {
            console.error("Export error:", err);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end(
                `Render error: ${err instanceof Error ? err.message : String(err)}`,
            );
            return;
        }
    }

    if (url === "/api/export-canvas/status") {
        const id = parsed.searchParams.get("id") || "";
        const job = renderJobs.get(id);
        if (!job) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "not_found" }));
            return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
            JSON.stringify({
                status: job.status,
                percent: job.percent,
                error: job.error,
                downloadUrl:
                    job.status === "done"
                        ? `/api/export-canvas/download?id=${encodeURIComponent(id)}`
                        : undefined,
            }),
        );
        return;
    }

    if (url === "/api/export-canvas/download") {
        const id = parsed.searchParams.get("id") || "";
        const job = renderJobs.get(id);
        if (!job || job.status !== "done" || !job.outputPath) {
            res.writeHead(404);
            res.end("Not Found");
            return;
        }
        const stat = fs.statSync(job.outputPath);
        res.writeHead(200, {
            "Content-Type": "video/mp4",
            "Content-Length": stat.size,
            "Cache-Control": "no-store",
        });
        const stream = fs.createReadStream(job.outputPath);
        stream.pipe(res);
        stream.on("close", () => {
            try {
                fs.unlinkSync(job.outputPath!);
            } catch {
                // ignore cleanup errors
            }
            job.tempFiles?.forEach((file) => {
                try {
                    fs.unlinkSync(file);
                } catch {
                    // ignore cleanup errors
                }
            });
            renderJobs.delete(id);
        });
        stream.on("error", (err) => {
            console.error("Stream error:", err);
            res.writeHead(500);
            res.end("Stream error");
        });
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
