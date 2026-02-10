export class LUTLoader {
    private gl: WebGL2RenderingContext;
    
    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
    }
    
    /**
     * Parse a .cube LUT file and convert it to a 3D texture
     * @param cubeFileContent - The text content of a .cube file
     * @param size - The LUT size (usually 33 for 1D LUTs, or 33/65 for 3D LUTs)
     * @returns WebGLTexture representing the LUT
     */
    loadCUBEFile(cubeFileContent: string, size: number = 33): WebGLTexture {
        const lines = cubeFileContent.split('\n').map(line => line.trim());
        
        // Parse the CUBE file
        const lutData: number[][] = [];
        let title = '';
        let minValues = [0, 0, 0];
        let maxValues = [1, 1, 1];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('TITLE')) {
                title = line.substring(6).trim();
            } else if (line.startsWith('LUT_3D_SIZE') || line.startsWith('LUT_1D_SIZE')) {
                const sizeMatch = line.match(/\d+/);
                if (sizeMatch) {
                    size = parseInt(sizeMatch[0]);
                }
            } else if (line.startsWith('LUT_3D_INPUT_RANGE') || line.startsWith('LUT_1D_INPUT_RANGE')) {
                const rangeMatch = line.match(/(\d+\.?\d*)\s+(\d+\.?\d*)/);
                if (rangeMatch) {
                    const min = parseFloat(rangeMatch[1]);
                    const max = parseFloat(rangeMatch[2]);
                    minValues = [min, min, min];
                    maxValues = [max, max, max];
                }
            } else if (line && !line.startsWith('#') && !line.match(/^[a-zA-Z_]/)) {
                // This is a data line with RGB values
                const values = line.split(/\s+/).map(v => parseFloat(v));
                if (values.length >= 3 && !isNaN(values[0]) && !isNaN(values[1]) && !isNaN(values[2])) {
                    // Normalize values to 0-1 range
                    const r = (values[0] - minValues[0]) / (maxValues[0] - minValues[0]);
                    const g = (values[1] - minValues[1]) / (maxValues[1] - minValues[1]);
                    const b = (values[2] - minValues[2]) / (maxValues[2] - minValues[2]);
                    
                    lutData.push([r, g, b]);
                }
            }
        }
        
        // Convert 1D LUT data to 3D if necessary
        if (lutData.length === size) {
            // This is a 1D LUT, convert to 3D
            const flatData: number[] = [];
            for (let b = 0; b < size; b++) {
                for (let g = 0; g < size; g++) {
                    for (let r = 0; r < size; r++) {
                        const index = Math.floor((r / size) * lutData.length);
                        const color = lutData[Math.min(index, lutData.length - 1)];
                        flatData.push(color[0], color[1], color[2]);
                    }
                }
            }
            return this.create3DTexture(flatData, size);
        } else {
            // Assume 3D LUT data - flatten to 1D array
            const flatData: number[] = [];
            let index = 0;
            
            for (let b = 0; b < size; b++) {
                for (let g = 0; g < size; g++) {
                    for (let r = 0; r < size; r++) {
                        if (index < lutData.length) {
                            const color = lutData[index++];
                            flatData.push(color[0], color[1], color[2]);
                        } else {
                            // Fallback to neutral values
                            flatData.push(r / (size - 1), g / (size - 1), b / (size - 1));
                        }
                    }
                }
            }
            return this.create3DTexture(flatData, size);
        }
    }
    
    /**
     * Create a 3D WebGL texture from LUT data
     * @param flatData - Flattened 3D array of RGB values
     * @param size - The size of the LUT (size x size x size)
     * @returns WebGLTexture
     */
    private create3DTexture(flatData: number[], size: number): WebGLTexture {
        const gl = this.gl;
        const texture = gl.createTexture()!;
        
        // Create texture
        gl.bindTexture(gl.TEXTURE_3D, texture);
        
        // Upload texture data
        gl.texImage3D(
            gl.TEXTURE_3D,
            0, // level
            gl.RGB, // internal format
            size, // width
            size, // height
            size, // depth
            0, // border
            gl.RGB, // format
            gl.FLOAT, // type
            new Float32Array(flatData)
        );
        
        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        
        gl.bindTexture(gl.TEXTURE_3D, null);
        
        return texture;
    }
    
    /**
     * Load a CUBE file from a URL
     * @param url - URL to the .cube file
     * @param size - Expected LUT size (optional, will be detected from file)
     * @returns Promise<WebGLTexture>
     */
    async loadCUBEFromURL(url: string, size?: number): Promise<WebGLTexture> {
        try {
            const response = await fetch(url);
            const cubeContent = await response.text();
            return this.loadCUBEFile(cubeContent, size);
        } catch (error) {
            console.error(`Failed to load CUBE file from ${url}:`, error);
            throw error;
        }
    }
    
    /**
     * Create a neutral identity LUT (no color transformation)
     * @param size - Size of the LUT
     * @returns WebGLTexture
     */
    createIdentityLUT(size: number = 33): WebGLTexture {
        const flatData: number[] = [];
        
        for (let b = 0; b < size; b++) {
            for (let g = 0; g < size; g++) {
                for (let r = 0; r < size; r++) {
                    flatData.push(
                        r / (size - 1),
                        g / (size - 1),
                        b / (size - 1)
                    );
                }
            }
        }
        
        return this.create3DTexture(flatData, size);
    }
    
    /**
     * Create a vintage film LUT
     * @param size - Size of the LUT
     * @returns WebGLTexture
     */
    createVintageLUT(size: number = 33): WebGLTexture {
        const flatData: number[] = [];
        
        for (let b = 0; b < size; b++) {
            for (let g = 0; g < size; g++) {
                for (let r = 0; r < size; r++) {
                    let red = r / (size - 1);
                    let green = g / (size - 1);
                    let blue = b / (size - 1);
                    
                    // Apply vintage film look
                    // Warm up the colors
                    red = red * 1.1;
                    green = green * 1.05;
                    blue = blue * 0.9;
                    
                    // Add slight contrast increase
                    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
                    const contrast = 1.1;
                    red = ((red - 0.5) * contrast) + 0.5;
                    green = ((green - 0.5) * contrast) + 0.5;
                    blue = ((blue - 0.5) * contrast) + 0.5;
                    
                    // Clamp values
                    red = Math.max(0, Math.min(1, red));
                    green = Math.max(0, Math.min(1, green));
                    blue = Math.max(0, Math.min(1, blue));
                    
                    flatData.push(red, green, blue);
                }
            }
        }
        
        return this.create3DTexture(flatData, size);
    }
    
    /**
     * Create a cinematic LUT
     * @param size - Size of the LUT
     * @returns WebGLTexture
     */
    createCinematicLUT(size: number = 33): WebGLTexture {
        const flatData: number[] = [];
        
        for (let b = 0; b < size; b++) {
            for (let g = 0; g < size; g++) {
                for (let r = 0; r < size; r++) {
                    let red = r / (size - 1);
                    let green = g / (size - 1);
                    let blue = b / (size - 1);
                    
                    // Apply cinematic look
                    // Slightly cool colors with higher contrast
                    red = red * 0.95;
                    green = green * 1.0;
                    blue = blue * 1.1;
                    
                    // Increase contrast
                    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
                    const contrast = 1.2;
                    red = ((red - 0.5) * contrast) + 0.5;
                    green = ((green - 0.5) * contrast) + 0.5;
                    blue = ((blue - 0.5) * contrast) + 0.5;
                    
                    // Clamp values
                    red = Math.max(0, Math.min(1, red));
                    green = Math.max(0, Math.min(1, green));
                    blue = Math.max(0, Math.min(1, blue));
                    
                    flatData.push(red, green, blue);
                }
            }
        }
        
        return this.create3DTexture(flatData, size);
    }
}