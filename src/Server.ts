import { join } from 'path';
import { readFileSync } from 'fs';

export class TiramisuServer {
    private server?: any;

    public start() {
        const templatePath = join(import.meta.dir, "template.html");
        const htmlContent = readFileSync(templatePath, "utf-8");

        this.server = Bun.serve({
            port: 0,
            fetch(req) {
                const url = new URL(req.url);
                
                // Serve the stage template on root
                if (url.pathname === "/") {
                    return new Response(htmlContent, {
                        headers: { "Content-Type": "text/html" },
                    });
                }

                // Serve static files (images, fonts) from the current working directory
                // This allows <img src="assets/logo.png"> to work
                const filePath = join(process.cwd(), url.pathname);
                const file = Bun.file(filePath);
                return new Response(file);
            },
        });

        return this.server.url.toString();
    }

    public stop() {
        this.server?.stop();
    }
}