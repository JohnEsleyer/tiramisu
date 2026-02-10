import { TiramisuEditor } from '../../src/TiramisuEditor.js';

// Example: Using the new WebGL-based Tiramisu Editor
async function demonstrateWebGLEditor() {
    // Create the editor
    const editor = new TiramisuEditor({
        canvas: 'gl-canvas',
        width: 1920,
        height: 1080,
        fps: 30,
        durationSeconds: 10,
        webgl: true,
        webcodecs: true
    });
    
    try {
        // Add a video clip to track 1
        const clip1 = editor.addVideo('sunny_beach.mp4', {
            start: 0,
            duration: 5,
            track: 1
        });
        
        // Add GPU effects to the clip
        editor.addEffectToClip(clip1.id, 'BrightnessContrast', {
            brightness: 0.1,
            contrast: 1.2
        });
        
        editor.addEffectToClip(clip1.id, 'Vignette', {
            intensity: 0.5,
            radius: 0.8
        });
        
        editor.addEffectToClip(clip1.id, 'ChromaKey', {
            color: '#00ff00',
            similarity: 0.3,
            softness: 0.1,
            spillReduction: 0.5
        });
        
        // Add a second video clip
        const clip2 = editor.addVideo('mountain_landscape.mp4', {
            start: 4,
            duration: 6,
            track: 1
        });
        
        // Add a vintage effect to the second clip
        editor.addEffectToClip(clip2.id, 'Saturation', {
            saturation: 0.8
        });
        
        // Add a transition between clips
        editor.addTransition(clip1, clip2, 'CrossZoom', {
            duration: 1.0,
            strength: 0.5
        });
        
        // Add an adjustment layer that affects all clips below
        const adjustmentTrack = editor.createTrack(5, 'Adjustment Layer');
        // TODO: Implement adjustment layer functionality
        
        // Load LUT file for color grading
        const response = await fetch('luts/vintage_film.cube');
        const lutContent = await response.text();
        // TODO: Load LUT using LUTLoader
        
        // Start playback
        editor.play();
        
        // You can also seek to specific times
        // editor.seek(3.5); // Seek to 3.5 seconds
        
        // Export using WebCodecs (client-side)
        // const blob = await editor.export((progress) => {
        //     console.log(`Export progress: ${progress.percent}%`);
        // });
        // 
        // // Download the exported video
        // const url = URL.createObjectURL(blob);
        // const a = document.createElement('a');
        // a.href = url;
        // a.download = 'edited_video.mp4';
        // a.click();
        
    } catch (error) {
        console.error('Failed to demonstrate WebGL editor:', error);
        editor.dispose();
    }
}

// HTML structure needed for this example:
/*
<canvas id="gl-canvas" width="1920" height="1080"></canvas>

<script src="path/to/tiramisu-webgl.js"></script>
<script>
    // Run the demonstration
    demonstrateWebGLEditor();
</script>
*/

export { demonstrateWebGLEditor };