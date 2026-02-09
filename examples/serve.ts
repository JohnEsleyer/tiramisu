import { Tiramisu } from "../src/Tiramisu.js";
import { serve } from "bun";

// Enhanced server with API endpoints for the new examples
const server = serve({
    port: 3000,
    routes: {
        // Serve example files
        "/examples/pro-editor/*": (req) => {
            const url = new URL(req.url);
            const filePath = url.pathname.replace("/examples/pro-editor", "/examples/pro-editor");
            return new Response(Bun.file(`./${filePath}`));
        },
        "/examples/marketing-gen/*": (req) => {
            const url = new URL(req.url);
            const filePath = url.pathname.replace("/examples/marketing-gen", "/examples/marketing-gen");
            return new Response(Bun.file(`./${filePath}`));
        },
        "/examples/data-driven-personalization/*": (req) => {
            const url = new URL(req.url);
            const filePath = url.pathname.replace("/examples/data-driven-personalization", "/examples/data-driven-personalization");
            return new Response(Bun.file(`./${filePath}`));
        },
        "/examples/social-media-creator/*": (req) => {
            const url = new URL(req.url);
            const filePath = url.pathname.replace("/examples/social-media-creator", "/examples/social-media-creator");
            return new Response(Bun.file(`./${filePath}`));
        },

        // API endpoint for pro-editor rendering
        "/api/render-pro": async (req) => {
            if (req.method !== "POST") {
                return new Response("Method not allowed", { status: 405 });
            }

            try {
                const { project } = await req.json();

                const renderConfig = {
                    width: 1280,
                    height: 720,
                    fps: 30,
                    durationSeconds: 10,
                    outputFile: "pro-editor-output.mp4",
                    data: project,
                    videos: project.filter((item: any) => item.type === 'video').map((item: any) => item.content),
                    assets: [],
                    headless: true
                };

                const tiramisu = new Tiramisu(renderConfig);

                // Add the render function
                tiramisu.addClip(0, 10, ({ ctx, width, height, frame, fps, data, layer, utils }) => {
                    const time = frame / fps;

                    data.forEach((item: any) => {
                        if (time >= item.start && time < (item.start + item.duration)) {
                            const itemLayer = layer.create(width, height);
                            
                            if (item.type === 'video') {
                                // For server-side, we'd need to handle video differently
                                // This is a simplified version
                                utils.drawMediaCover(itemLayer.ctx, null, width, height);
                            } else if (item.type === 'text') {
                                itemLayer.ctx.fillStyle = "white";
                                itemLayer.ctx.font = `bold ${80 * item.scale}px Inter`;
                                itemLayer.ctx.textAlign = "center";
                                itemLayer.ctx.fillText(item.content, item.x, item.y);
                            }

                            if (item.filters.blur > 0) itemLayer.applyBlur(item.filters.blur);
                            if (item.filters.brightness !== 1) itemLayer.applyBrightness(item.filters.brightness - 1);
                            
                            itemLayer.drawTo(ctx);
                        }
                    });
                });

                await tiramisu.render();

                // Return the rendered video
                const videoFile = Bun.file("pro-editor-output.mp4");
                return new Response(videoFile, {
                    headers: {
                        "Content-Type": "video/mp4",
                        "Content-Disposition": "attachment; filename=pro-editor-output.mp4"
                    }
                });

            } catch (error) {
                console.error("Render error:", error);
                return new Response(JSON.stringify({ error: "Failed to render video" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        },

        // API endpoint for marketing generator
        "/api/render-marketing": async (req) => {
            if (req.method !== "POST") {
                return new Response("Method not allowed", { status: 405 });
            }

            try {
                const { template, duration, customText } = await req.json();

                const renderConfig = {
                    width: 1280,
                    height: 720,
                    fps: 30,
                    durationSeconds: duration || 5,
                    outputFile: "marketing-output.mp4",
                    data: { template, customText },
                    videos: ['/bg.mp4', '/product.mp4'],
                    assets: [],
                    headless: true
                };

                const tiramisu = new Tiramisu(renderConfig);

                tiramisu.addClip(0, duration || 5, ({ ctx, width, height, localProgress, layer, videos, utils }) => {
                    // Background with blur
                    const bg = layer.create();
                    utils.drawMediaCover(bg.ctx, null, width, height);
                    bg.applyBlur(15);
                    bg.drawTo(ctx);

                    // Masked content (simplified)
                    const drawText = (c: CanvasRenderingContext2D) => {
                        c.font = "900 200px Montserrat";
                        c.textAlign = "center";
                        c.fillStyle = "white";
                        c.fillText(customText || "SALE", width/2, height/2);
                    };
                    
                    const drawProduct = (c: CanvasRenderingContext2D) => {
                        utils.drawMediaFit(c, null, width, height);
                    };

                    utils.drawMasked(ctx, drawProduct, drawText);
                    
                    // Ticker text
                    ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
                    const tickerX = (localProgress * -2000) % width;
                    ctx.font = "40px Monospace";
                    ctx.fillText("50% OFF - LIMITED TIME - 50% OFF - LIMITED TIME", tickerX, 700);
                });

                await tiramisu.render();

                const videoFile = Bun.file("marketing-output.mp4");
                return new Response(videoFile, {
                    headers: {
                        "Content-Type": "video/mp4",
                        "Content-Disposition": "attachment; filename=marketing-output.mp4"
                    }
                });

            } catch (error) {
                console.error("Marketing render error:", error);
                return new Response(JSON.stringify({ error: "Failed to render marketing video" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        },

        // API endpoint for data-driven personalization
        "/api/render-personalized": async (req) => {
            if (req.method !== "POST") {
                return new Response("Method not allowed", { status: 405 });
            }

            try {
                const { customerId, customerData } = await req.json();

                const renderConfig = {
                    width: 1920,
                    height: 1080,
                    fps: 60,
                    durationSeconds: 15,
                    outputFile: `personalized-${customerId}.mp4`,
                    data: customerData,
                    videos: ['/template.mp4'],
                    assets: [],
                    headless: true
                };

                const tiramisu = new Tiramisu(renderConfig);

                tiramisu.addClip(0, 15, ({ ctx, width, height, data, layer }) => {
                    // Personalized background based on loyalty tier
                    const gradient = ctx.createLinearGradient(0, 0, width, height);
                    if (data.loyaltyTier === "Gold") {
                        gradient.addColorStop(0, "#FFD700");
                        gradient.addColorStop(1, "#FFA500");
                    } else if (data.loyaltyTier === "Silver") {
                        gradient.addColorStop(0, "#C0C0C0");
                        gradient.addColorStop(1, "#808080");
                    } else {
                        gradient.addColorStop(0, "#4CAF50");
                        gradient.addColorStop(1, "#45a049");
                    }
                    
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, width, height);
                    
                    // Personalized text
                    ctx.fillStyle = "#1a1a1a";
                    ctx.font = "bold 72px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText(`Welcome back, ${data.name}!`, width/2, 100);
                    
                    // Dynamic pricing
                    const basePrice = 199;
                    const discount = data.loyaltyTier === "Gold" ? 0.15 : data.loyaltyTier === "Silver" ? 0.10 : 0.05;
                    const finalPrice = Math.round(basePrice * (1 - discount));
                    
                    ctx.fillStyle = "#ff4444";
                    ctx.font = "bold 48px Arial";
                    ctx.fillText(`Special Price: $${finalPrice} (${Math.round(discount * 100)}% off)`, width/2, height - 20);
                });

                await tiramisu.render();

                const videoFile = Bun.file(`personalized-${customerId}.mp4`);
                return new Response(videoFile, {
                    headers: {
                        "Content-Type": "video/mp4",
                        "Content-Disposition": `attachment; filename=personalized-${customerId}.mp4`
                    }
                });

            } catch (error) {
                console.error("Personalized render error:", error);
                return new Response(JSON.stringify({ error: "Failed to render personalized video" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        },

        // API endpoint for social media creator
        "/api/render-social": async (req) => {
            if (req.method !== "POST") {
                return new Response("Method not allowed", { status: 405 });
            }

            try {
                const { template, format, quality } = await req.json();

                // Determine dimensions based on template
                let width = 1920, height = 1080;
                switch (template) {
                    case 'tiktok':
                        width = 1080; height = 1920;
                        break;
                    case 'instagram':
                        width = 1080; height = 1080;
                        break;
                    case 'youtube':
                        width = 1920; height = 1080;
                        break;
                    case 'twitter':
                        width = 1200; height = 675;
                        break;
                }

                const renderConfig = {
                    width,
                    height,
                    fps: 30,
                    durationSeconds: template === 'youtube' ? 5 : 15,
                    outputFile: `social-${template}.mp4`,
                    data: { template, quality },
                    videos: ['/content.mp4'],
                    assets: [],
                    headless: true
                };

                const tiramisu = new Tiramisu(renderConfig);

                tiramisu.addClip(0, renderConfig.durationSeconds, ({ ctx, width, height, localProgress, data }) => {
                    // Platform-specific styling
                    if (data.template === 'tiktok') {
                        // TikTok-style gradient background
                        const gradient = ctx.createLinearGradient(0, 0, width, height);
                        gradient.addColorStop(0, "#ff0050");
                        gradient.addColorStop(1, "#00f2ea");
                        ctx.fillStyle = gradient;
                        ctx.fillRect(0, 0, width, height);
                        
                        // Bold text
                        ctx.fillStyle = "yellow";
                        ctx.font = "bold 120px Arial";
                        ctx.textAlign = "center";
                        ctx.fillText("VIRAL CONTENT", width/2, height/2);
                        
                    } else if (data.template === 'instagram') {
                        // Instagram gradient
                        ctx.fillStyle = "#405DE6";
                        ctx.fillRect(0, 0, width, height);
                        
                        ctx.fillStyle = "white";
                        ctx.font = "bold 72px Arial";
                        ctx.textAlign = "center";
                        ctx.fillText("@yourstory", width/2, height/2);
                        
                    } else if (data.template === 'youtube') {
                        // YouTube thumbnail style
                        ctx.fillStyle = "#FF0000";
                        ctx.fillRect(0, 0, width, height);
                        
                        ctx.fillStyle = "yellow";
                        ctx.font = "900 120px Arial";
                        ctx.textAlign = "center";
                        ctx.strokeStyle = "black";
                        ctx.lineWidth = 8;
                        ctx.strokeText("INCREDIBLE!", width/2, height/2);
                        ctx.fillText("INCREDIBLE!", width/2, height/2);
                    }
                });

                await tiramisu.render();

                const videoFile = Bun.file(`social-${template}.mp4`);
                return new Response(videoFile, {
                    headers: {
                        "Content-Type": "video/mp4",
                        "Content-Disposition": `attachment; filename=social-${template}.mp4`
                    }
                });

            } catch (error) {
                console.error("Social render error:", error);
                return new Response(JSON.stringify({ error: "Failed to render social media video" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        },

        // Serve static files and assets
        "/": (req) => {
            return new Response(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tiramisu Pro Examples</title>
    <style>
        body {
            margin: 0;
            padding: 2rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            text-align: center;
        }
        h1 {
            font-size: 3rem;
            margin-bottom: 2rem;
            background: linear-gradient(45deg, #FFD700, #FFA500);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .examples-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin: 3rem 0;
        }
        .example-card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 2rem;
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease;
        }
        .example-card:hover {
            transform: translateY(-10px);
        }
        .example-card h3 {
            color: #FFD700;
            margin-bottom: 1rem;
        }
        .example-card a {
            display: inline-block;
            background: linear-gradient(45deg, #4CAF50, #45a049);
            color: white;
            text-decoration: none;
            padding: 1rem 2rem;
            border-radius: 25px;
            font-weight: 600;
            margin-top: 1rem;
            transition: all 0.3s ease;
        }
        .example-card a:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 Tiramisu Pro Examples</h1>
        <p>Advanced video generation examples showcasing WebCodecs, interactive editing, and data-driven personalization</p>
        
        <div class="examples-grid">
            <div class="example-card">
                <h3>🎭 Pro Editor</h3>
                <p>Interactive timeline editor with drag-and-drop capabilities, real-time preview, and multi-track compositing.</p>
                <a href="/examples/pro-editor/">Try Pro Editor</a>
            </div>
            
            <div class="example-card">
                <h3>📈 Marketing Generator</h3>
                <p>Create viral marketing videos with dynamic masking, audio-reactive elements, and professional effects.</p>
                <a href="/examples/marketing-gen/">Try Marketing Generator</a>
            </div>
            
            <div class="example-card">
                <h3>👤 Data-Driven Personalization</h3>
                <p>Generate thousands of personalized videos using customer data, loyalty tiers, and purchase history.</p>
                <a href="/examples/data-driven-personalization/">Try Personalization</a>
            </div>
            
            <div class="example-card">
                <h3>📱 Social Media Creator</h3>
                <p>Multi-platform content generator for TikTok, Instagram, YouTube, and Twitter with platform-specific optimization.</p>
                <a href="/examples/social-media-creator/">Try Social Creator</a>
            </div>
        </div>
        
        <div style="margin-top: 3rem; padding: 2rem; background: rgba(255,255,255,0.1); border-radius: 15px;">
            <h3>🚀 Key Features</h3>
            <ul style="text-align: left; max-width: 600px; margin: 0 auto;">
                <li>⚡ <strong>Zero-Disk WebCodecs:</strong> Lightning-fast video processing without temporary files</li>
                <li>🎨 <strong>Layer Compositing:</strong> Photoshop-style layer system with blend modes and effects</li>
                <li>📊 <strong>Data-Driven:</strong> Generate personalized content from JSON data sources</li>
                <li>🎵 <strong>Audio-Reactive:</strong> Visuals that sync with music beats and audio analysis</li>
                <li>🌐 <strong>Multi-Platform:</strong> Optimized output for all social media platforms</li>
                <li>🔄 <strong>Batch Processing:</strong> Generate hundreds of videos simultaneously</li>
            </ul>
        </div>
    </div>
</body>
</html>
            `, {
                headers: { "Content-Type": "text/html" }
            });
        }
    }
});

console.log("🎬 Tiramisu Pro Server running on http://localhost:3000");
console.log("📁 Available examples:");
console.log("  - Pro Editor: http://localhost:3000/examples/pro-editor/");
console.log("  - Marketing Generator: http://localhost:3000/examples/marketing-gen/");
console.log("  - Data-Driven Personalization: http://localhost:3000/examples/data-driven-personalization/");
console.log("  - Social Media Creator: http://localhost:3000/examples/social-media-creator/");

export default server;