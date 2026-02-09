import http from "node:http";
import fs from "node:fs";
import path from "node:path";

export class TiramisuServer {
    private server?: http.Server;
    private port?: number;

    public start(): string {
        // Inline template to prevent path resolution errors in SSR/Bundlers
        const htmlContent = `<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background-color:black;"></body></html>`;

        this.server = http.createServer(async (req, res) => {
            const url = req.url || "/";
            
            if (url === "/") {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(htmlContent);
                return;
            }
            
            if (url === "/favicon.ico") {
                res.writeHead(404);
                res.end();
                return;
            }

            // Serve static assets from the project root
            const filePath = url.startsWith("/") ? url.slice(1) : url;
            const absolutePath = path.join(process.cwd(), filePath);
            
            if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
                const ext = path.extname(absolutePath);
                const contentType = this.getContentType(ext);
                const stat = fs.statSync(absolutePath);
                
                // Handle HTTP Range requests for video files
                const range = req.headers.range;
                if (range && (ext === '.mp4' || ext === '.webm' || ext === '.ogg')) {
                    const parts = range.replace(/bytes=/, "").split("-");
                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                    const chunksize = (end - start) + 1;
                    
                    // Validate range
                    if (start >= stat.size || end >= stat.size || start > end) {
                        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
                        res.end();
                        return;
                    }
                    
                    res.writeHead(206, {
                        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': chunksize,
                        'Content-Type': contentType,
                    });
                    
                    const stream = fs.createReadStream(absolutePath, { start, end });
                    stream.pipe(res);
                } else {
                    // Regular file serving
                    res.writeHead(200, { 
                        'Content-Type': contentType,
                        'Content-Length': stat.size,
                        'Accept-Ranges': 'bytes'
                    });
                    fs.createReadStream(absolutePath).pipe(res);
                }
            } else {
                res.writeHead(404);
                res.end("Not Found");
            }
        });

        this.server.listen(0); // Listen on random port
        const address = this.server.address();
        if (address && typeof address === 'object') {
            this.port = address.port;
        } else if (typeof address === 'string') {
            // Unix socket case, not expected here but handle gracefully
            this.port = 0;
        } else if (address) {
            this.port = address;
        } else {
            this.port = 0;
        }
        
        return `http://localhost:${this.port}`;
    }

    private getContentType(ext: string): string {
        const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
            '.wasm': 'application/wasm',
            '.ts': 'application/typescript',
        };
        return mimeTypes[ext] || 'text/plain';
    }

    public stop() {
        this.server?.close();
    }
}
