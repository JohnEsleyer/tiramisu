import { join } from 'path';
import { readFileSync } from 'fs';

export class TiramisuServer {
    private server?: any;

    public start() {
        const templatePath = join(import.meta.dir, "template.html");
        const htmlContent = readFileSync(templatePath, "utf-8");

        this.server = Bun.serve({
            port: 0,
            fetch() {
                return new Response(htmlContent, {
                    headers: { "Content-Type": "text/html" },
                });
            },
        });

        return this.server.url.toString();
    }

    public stop() {
        this.server?.stop();
    }
}
