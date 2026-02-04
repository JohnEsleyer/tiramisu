import { join } from 'path';
import { readFileSync } from 'fs';

export class TiramisuServer {
    private server?: any;

    public start() {
        // --- MISSING INITIALIZATION ---
        const templatePath = join(import.meta.dir, "template.html");
        const htmlContent = readFileSync(templatePath, "utf-8");
        // --- END MISSING INITIALIZATION ---

        this.server = Bun.serve({
            port: 0,
            async fetch(req) {
                const url = new URL(req.url);
                
                // Serve the stage template on root
                if (url.pathname === "/") {
                    return new Response(htmlContent, {
                        headers: { "Content-Type": "text/html" },
                    });
                }

                // Ignore favicon to prevent log spam/errors
                if (url.pathname === "/favicon.ico") {
                    return new Response(null, { status: 404 });
                }

                // Serve static files (images, fonts, video frames)
                const filePath = join(process.cwd(), url.pathname);
                const file = Bun.file(filePath);

                if (await file.exists()) {
                    if (filePath.endsWith(".mp4") || filePath.endsWith(".jpg")) {
                        console.log(`[Server] Serving Asset: ${url.pathname}`);
                    }
                    return new Response(file);
                }

                // --- CRITICAL DEBUG LOGGING ---
                console.error(`[Server] 404 NOT FOUND: ${url.pathname} (Attempted FS Path: ${filePath})`); 
                return new Response("Not Found", { status: 404 });
            },
        });

        return this.server.url.toString();
    }

    public stop() {
        this.server?.stop();
    }
}