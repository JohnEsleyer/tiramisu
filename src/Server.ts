export class TiramisuServer {
    private server?: any;

    public start() {
        // Minimal HTML to host the canvas.
        // Puppeteer injects the script/canvas, so we just need a valid body.
        const htmlContent = `<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background-color:black;"></body></html>`;

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

                if (url.pathname === "/favicon.ico") {
                    return new Response(null, { status: 404 });
                }

                // Serve static files from CWD (current working directory of the project using the lib)
                const filePath = url.pathname.startsWith("/")
                    ? url.pathname.slice(1)
                    : url.pathname;
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
