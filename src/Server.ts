export class TiramisuServer {
    private server?: any;

    public start() {
        // Inline template to prevent path resolution errors in SSR/Bundlers
        const htmlContent = `<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background-color:black;"></body></html>`;

        this.server = Bun.serve({
            port: 0,
            async fetch(req) {
                const url = new URL(req.url);
                if (url.pathname === "/") {
                    return new Response(htmlContent, {
                        headers: { "Content-Type": "text/html" },
                    });
                }
                if (url.pathname === "/favicon.ico")
                    return new Response(null, { status: 404 });

                // Serve static assets from the project root
                const filePath = url.pathname.startsWith("/")
                    ? url.pathname.slice(1)
                    : url.pathname;
                const file = Bun.file(filePath);
                if (await file.exists()) return new Response(file);

                return new Response("Not Found", { status: 404 });
            },
        });

        return this.server.url.toString();
    }

    public stop() {
        this.server?.stop();
    }
}
