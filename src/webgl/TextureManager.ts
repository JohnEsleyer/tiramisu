import { TexturePool, VideoFrameInfo } from '../types.js';

export class TextureManager implements TexturePool {
    private gl: WebGL2RenderingContext;
    private texturePool: WebGLTexture[] = [];
    private usedTextures: Set<WebGLTexture> = new Set();
    private assetToTextureMap: Map<string | HTMLImageElement | VideoFrame, WebGLTexture> = new Map();
    private videoFrameCache: Map<string, VideoFrameInfo[]> = new Map();
    
    // Pool configuration
    private maxPoolSize: number = 32;
    private defaultTextureWidth: number;
    private defaultTextureHeight: number;
    
    constructor(gl: WebGL2RenderingContext, maxPoolSize: number = 32) {
        this.gl = gl;
        this.maxPoolSize = maxPoolSize;
        this.defaultTextureWidth = 1920;
        this.defaultTextureHeight = 1080;
        
        // Pre-allocate some textures for the pool
        this.initializePool();
    }
    
    private initializePool(): void {
        for (let i = 0; i < Math.min(8, this.maxPoolSize); i++) {
            const texture = this.createTexture();
            this.texturePool.push(texture);
        }
    }
    
    private createTexture(width?: number, height?: number): WebGLTexture {
        const gl = this.gl;
        const texture = gl.createTexture()!;
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width || this.defaultTextureWidth,
            height || this.defaultTextureHeight,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );
        
        // Set optimal texture parameters for video rendering
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        return texture;
    }
    
    getTexture(): WebGLTexture | null {
        // Try to get a texture from the pool first
        if (this.texturePool.length > 0) {
            const texture = this.texturePool.pop()!;
            this.usedTextures.add(texture);
            return texture;
        }
        
        // If pool is empty and we haven't reached max size, create a new texture
        if (this.usedTextures.size < this.maxPoolSize) {
            const texture = this.createTexture();
            this.usedTextures.add(texture);
            return texture;
        }
        
        // Pool is exhausted
        console.warn('TextureManager: Pool exhausted, consider increasing maxPoolSize');
        return null;
    }
    
    releaseTexture(texture: WebGLTexture): void {
        if (this.usedTextures.has(texture)) {
            this.usedTextures.delete(texture);
            this.texturePool.push(texture);
        }
    }
    
    clear(): void {
        // Return all used textures to the pool
        this.usedTextures.forEach(texture => {
            this.texturePool.push(texture);
        });
        this.usedTextures.clear();
        
        // Clear asset mappings
        this.assetToTextureMap.clear();
        
        // Clear video frame cache
        this.videoFrameCache.clear();
    }
    
    // Asset mapping methods
    getAssetTexture(asset: string | HTMLImageElement | VideoFrame): WebGLTexture | null {
        return this.assetToTextureMap.get(asset) || null;
    }
    
    setAssetTexture(asset: string | HTMLImageElement | VideoFrame, texture: WebGLTexture): void {
        this.assetToTextureMap.set(asset, texture);
    }
    
    removeAssetTexture(asset: string | HTMLImageElement | VideoFrame): void {
        const texture = this.assetToTextureMap.get(asset);
        if (texture) {
            this.releaseTexture(texture);
            this.assetToTextureMap.delete(asset);
        }
    }
    
    // Video frame upload methods
    uploadVideoFrame(frame: VideoFrame, targetTexture?: WebGLTexture): WebGLTexture {
        const gl = this.gl;
        const texture = targetTexture || this.getTexture();
        
        if (!texture) {
            throw new Error('Failed to get texture for video frame upload');
        }
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // WebGL2 supports direct VideoFrame upload
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            frame
        );
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        // Immediately close the VideoFrame to prevent memory leaks
        frame.close();
        
        return texture;
    }
    
    uploadVideoFrameOptimized(frame: VideoFrame, targetTexture?: WebGLTexture): WebGLTexture {
        const gl = this.gl;
        const texture = targetTexture || this.getTexture();
        
        if (!texture) {
            throw new Error('Failed to get texture for video frame upload');
        }
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        
        // Use texSubImage2D for potentially better performance on existing textures
        // This is especially useful when updating the same texture repeatedly
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            frame
        );
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        // Close the VideoFrame to prevent memory leaks
        frame.close();
        
        return texture;
    }
    
    // Image upload methods
    uploadImage(image: HTMLImageElement, targetTexture?: WebGLTexture): WebGLTexture {
        const gl = this.gl;
        const texture = targetTexture || this.getTexture();
        
        if (!texture) {
            throw new Error('Failed to get texture for image upload');
        }
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
        
        // Generate mipmaps for better image quality at different scales
        gl.generateMipmap(gl.TEXTURE_2D);
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        return texture;
    }
    
    // Canvas upload methods
    uploadCanvas(canvas: HTMLCanvasElement, targetTexture?: WebGLTexture): WebGLTexture {
        const gl = this.gl;
        const texture = targetTexture || this.getTexture();
        
        if (!texture) {
            throw new Error('Failed to get texture for canvas upload');
        }
        
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            canvas
        );
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        return texture;
    }
    
    // Video frame caching for better performance
    cacheVideoFrame(videoId: string, frame: VideoFrame, timestamp: number): WebGLTexture {
        const texture = this.uploadVideoFrame(frame);
        
        if (!this.videoFrameCache.has(videoId)) {
            this.videoFrameCache.set(videoId, []);
        }
        
        const frameInfo: VideoFrameInfo = {
            frame: frame,
            timestamp,
            texture
        };
        
        this.videoFrameCache.get(videoId)!.push(frameInfo);
        
        // Limit cache size per video to prevent memory issues
        const cache = this.videoFrameCache.get(videoId)!;
        if (cache.length > 10) {
            const removed = cache.shift()!;
            if (removed.texture) {
                this.releaseTexture(removed.texture);
            }
        }
        
        return texture;
    }
    
    getCachedVideoFrame(videoId: string, timestamp: number, tolerance: number = 0.1): WebGLTexture | null {
        const cache = this.videoFrameCache.get(videoId);
        if (!cache) return null;
        
        // Find the closest frame within tolerance
        let closestFrame: VideoFrameInfo | null = null;
        let closestDistance = Infinity;
        
        for (const frameInfo of cache) {
            const distance = Math.abs(frameInfo.timestamp - timestamp);
            if (distance <= tolerance && distance < closestDistance) {
                closestFrame = frameInfo;
                closestDistance = distance;
            }
        }
        
        return closestFrame?.texture || null;
    }
    
    clearVideoFrameCache(videoId?: string): void {
        if (videoId) {
            const cache = this.videoFrameCache.get(videoId);
            if (cache) {
                cache.forEach(frameInfo => {
                    if (frameInfo.texture) {
                        this.releaseTexture(frameInfo.texture);
                    }
                });
                this.videoFrameCache.delete(videoId);
            }
        } else {
            // Clear all video frame caches
            this.videoFrameCache.forEach(cache => {
                cache.forEach(frameInfo => {
                    if (frameInfo.texture) {
                        this.releaseTexture(frameInfo.texture);
                    }
                });
            });
            this.videoFrameCache.clear();
        }
    }
    
    // Memory management
    getMemoryUsage(): {
        totalTextures: number;
        usedTextures: number;
        pooledTextures: number;
        cachedFrames: number;
    } {
        return {
            totalTextures: this.usedTextures.size + this.texturePool.length,
            usedTextures: this.usedTextures.size,
            pooledTextures: this.texturePool.length,
            cachedFrames: Array.from(this.videoFrameCache.values())
                .reduce((total, cache) => total + cache.length, 0)
        };
    }
    
    setDefaultTextureSize(width: number, height: number): void {
        this.defaultTextureWidth = width;
        this.defaultTextureHeight = height;
    }
    
    // Cleanup
    dispose(): void {
        const gl = this.gl;
        
        // Delete all textures in the pool
        this.texturePool.forEach(texture => gl.deleteTexture(texture));
        this.texturePool = [];
        
        // Delete all used textures
        this.usedTextures.forEach(texture => gl.deleteTexture(texture));
        this.usedTextures.clear();
        
        // Clear all mappings and caches
        this.assetToTextureMap.clear();
        this.videoFrameCache.clear();
    }
}