import { join } from 'path';
import { readFileSync } from 'fs';

export class TiramisuServer {
    private server?: any;

    public start() {
        const templatePath = join(import.meta.dir, "template.html");
        const htmlContent = readFileSync(templatePath, "utf-8");

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

                // Serve static files (images, fonts) from the current working directory
                const filePath = join(process.cwd(), url.pathname);
                const file = Bun.file(filePath);

                if (await file.exists()) {
                    return new Response(file);
                }

                return new Response("Not Found", { status: 404 });
            },
        });

        return this.server.url.toString();
    }

    public stop() {
        this.server?.stop();
    }
}