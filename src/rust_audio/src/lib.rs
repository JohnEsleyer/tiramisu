use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct AudioVisualizer {
    fft_size: usize,
    smoothing_time_constant: f32,
    min_decibels: f32,
    max_decibels: f32,
    
    // State for Smoothing (Previous Frame's frequency data)
    previous_magnitudes: Vec<f32>,
    
    // Pre-computed Blackman Window
    window_table: Vec<f32>,
    
    // State for DC Blocker Filter (High-pass)
    // Stores: (prev_input, prev_output)
    dc_filter_state: (f32, f32),
}

#[wasm_bindgen]
impl AudioVisualizer {
    #[wasm_bindgen(constructor)]
    pub fn new() -> AudioVisualizer {
        let fft_size = 64; 
        
        // 1. Pre-compute Blackman Window (Exact Web Audio spec)
        // alpha = 0.42, beta = 0.5, gamma = 0.08
        let mut window_table = Vec::with_capacity(fft_size);
        for i in 0..fft_size {
            let n = i as f32;
            let n_minus_1 = (fft_size - 1) as f32;
            let val = 0.42 
                - 0.5 * (2.0 * std::f32::consts::PI * n / n_minus_1).cos() 
                + 0.08 * (4.0 * std::f32::consts::PI * n / n_minus_1).cos();
            window_table.push(val);
        }

        AudioVisualizer {
            fft_size,
            smoothing_time_constant: 0.8,
            min_decibels: -100.0,
            max_decibels: -30.0,
            previous_magnitudes: vec![0.0; fft_size / 2],
            window_table,
            dc_filter_state: (0.0, 0.0),
        }
    }

    pub fn process_frame(&mut self, pcm_data: &[i16]) -> Vec<f32> {
        // --- STEP 1: DC BLOCKER FILTER ---
        // We must process the ENTIRE chunk (e.g. 1470 samples) to maintain 
        // filter continuity, even though we only use the last 64 for the FFT.
        // This removes the "Static Left Bar" issue.
        
        let mut filtered_chunk = Vec::with_capacity(pcm_data.len());
        let (mut prev_x, mut prev_y) = self.dc_filter_state;
        let r = 0.995; // Filter coefficient (Standard approx ~20Hz cutoff)

        for &sample_i16 in pcm_data {
            let x = sample_i16 as f32 / 32768.0; // Normalize -1.0 to 1.0
            
            // High-pass filter difference equation:
            // y[n] = x[n] - x[n-1] + R * y[n-1]
            let y = x - prev_x + r * prev_y;
            
            filtered_chunk.push(y);
            prev_x = x;
            prev_y = y;
        }
        
        // Save state for next frame
        self.dc_filter_state = (prev_x, prev_y);


        // --- STEP 2: SNAPSHOT (Last 64 samples) ---
        let len = filtered_chunk.len();
        let mut time_data = vec![0.0; self.fft_size];
        
        // Grab the last 64 samples from the filtered data
        if len >= self.fft_size {
            for i in 0..self.fft_size {
                let sample = filtered_chunk[len - self.fft_size + i];
                time_data[i] = sample * self.window_table[i];
            }
        } else {
            // Padding if start of file (unlikely to happen in loop, but safe)
            for i in 0..len {
                let sample = filtered_chunk[i];
                time_data[self.fft_size - len + i] = sample * self.window_table[self.fft_size - len + i];
            }
        }


        // --- STEP 3: DISCRETE FOURIER TRANSFORM (DFT) ---
        // 64-point DFT is O(N^2) = 4096 ops. Extremely fast.
        let half_size = self.fft_size / 2;
        let mut output = Vec::with_capacity(half_size);

        for k in 0..half_size {
            let mut sum_real = 0.0;
            let mut sum_imag = 0.0;
            let k_f = k as f32;
            let n_f = self.fft_size as f32;

            // Standard Correlation
            for n in 0..self.fft_size {
                let angle = -2.0 * std::f32::consts::PI * k_f * (n as f32) / n_f;
                // Pre-computing sin/cos table would be faster, but this is fast enough
                sum_real += time_data[n] * angle.cos();
                sum_imag += time_data[n] * angle.sin();
            }

            // Calculate Magnitude (Linear Energy)
            // Note: We divide by fft_size to normalize, matching AnalyserNode behavior roughly
            let magnitude = (sum_real * sum_real + sum_imag * sum_imag).sqrt() / self.fft_size as f32;
            
            // Multiply by 2.0 because we dropped the negative frequencies (Parseval's theorem correction)
            // Except for DC (k=0), but AnalyserNode implementation details vary. 
            // Scaling by roughly ~4.0-8.0 aligns best with the 0-255 Uint8 output of browsers.
            // Let's use a "Visual Scaling Factor" to match the browser's perceived height.
            let visual_magnitude = magnitude * 4.0;

            // --- STEP 4: TEMPORAL SMOOTHING ---
            // We smooth the MAGNITUDE before dB conversion (Standard Web Audio physics)
            let smoothed = (self.previous_magnitudes[k] * self.smoothing_time_constant) 
                         + (visual_magnitude * (1.0 - self.smoothing_time_constant));
            
            self.previous_magnitudes[k] = smoothed;

            // --- STEP 5: DECIBEL CONVERSION ---
            // 20 * log10(x)
            let val = if smoothed < 1e-20 { 1e-20 } else { smoothed };
            let db = 20.0 * val.log10();

            // --- STEP 6: MAPPING (-100dB to -30dB) ---
            let scaled = (db - self.min_decibels) / (self.max_decibels - self.min_decibels);
            
            // Clamp 0.0 to 1.0
            let mut final_val = scaled.max(0.0).min(1.0);

            // Emulate the 8-bit quantization noise floor of the browser (1/255)
            // This cleans up the "jittery" bars at the bottom
            if final_val < 0.004 { final_val = 0.0; }

            output.push(final_val);
        }

        output
    }
}