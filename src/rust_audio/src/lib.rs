use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct AudioVisualizer {
    fft_size: usize,
    smoothing_time_constant: f32,
    min_decibels: f32,
    max_decibels: f32,
    previous_frame: Vec<f32>,
    window_table: Vec<f32>,
}

#[wasm_bindgen]
impl AudioVisualizer {
    #[wasm_bindgen(constructor)]
    pub fn new() -> AudioVisualizer {
        let fft_size = 64; // Matches Client.ts (this.audioAnalyser.fftSize = 64)
        
        // Pre-compute Blackman window (Standard for Web Audio API)
        let mut window_table = Vec::with_capacity(fft_size);
        for i in 0..fft_size {
            let n = i as f32;
            let n_minus_1 = (fft_size - 1) as f32;
            // Blackman window formula
            let alpha = 0.42;
            let beta = 0.5;
            let gamma = 0.08;
            let val = alpha 
                - beta * (2.0 * std::f32::consts::PI * n / n_minus_1).cos() 
                + gamma * (4.0 * std::f32::consts::PI * n / n_minus_1).cos();
            window_table.push(val);
        }

        AudioVisualizer {
            fft_size,
            smoothing_time_constant: 0.8, // Matches default Web Audio smoothing
            min_decibels: -100.0,
            max_decibels: -30.0,
            previous_frame: vec![0.0; fft_size / 2],
            window_table,
        }
    }

    pub fn process_frame(&mut self, pcm_data: &[i16]) -> Vec<f32> {
        // 1. Snapshot: AnalyserNode looks at the *current* contents of the buffer.
        // We take the LAST fft_size samples to simulate "now".
        let len = pcm_data.len();
        let mut time_data = vec![0.0; self.fft_size];
        
        if len >= self.fft_size {
            for i in 0..self.fft_size {
                // Normalize i16 (-32768 to 32767) to f32 (-1.0 to 1.0)
                let sample = pcm_data[len - self.fft_size + i] as f32 / 32768.0;
                // Apply Blackman Window immediately
                time_data[i] = sample * self.window_table[i];
            }
        } else {
            // Not enough data (start of song), pad with 0
            for i in 0..len {
                let sample = pcm_data[i] as f32 / 32768.0;
                time_data[self.fft_size - len + i] = sample * self.window_table[self.fft_size - len + i];
            }
        }

        // 2. Perform DFT (Discrete Fourier Transform)
        // Since N=64, O(N^2) is 4096 ops, which is negligible. No need for complex FFT lib.
        let half_size = self.fft_size / 2;
        let mut output = Vec::with_capacity(half_size);

        for k in 0..half_size {
            let mut sum_real = 0.0;
            let mut sum_imag = 0.0;
            let k_f = k as f32;
            let n_f = self.fft_size as f32;

            for n in 0..self.fft_size {
                let angle = -2.0 * std::f32::consts::PI * k_f * (n as f32) / n_f;
                sum_real += time_data[n] * angle.cos();
                sum_imag += time_data[n] * angle.sin();
            }

            // Calculate Magnitude
            let magnitude = (sum_real * sum_real + sum_imag * sum_imag).sqrt();
            
            // 3. Convert to Decibels (20 * log10)
            // Avoid log(0)
            let val = if magnitude < 1e-20 { 1e-20 } else { magnitude };
            let db = 20.0 * val.log10();

            // 4. Map to 0.0 - 1.0 range based on min/max decibels
            let scaled = (db - self.min_decibels) / (self.max_decibels - self.min_decibels);
            let clamped = scaled.max(0.0).min(1.0);

            // 5. Apply Temporal Smoothing
            // value = (prev * smooth) + (curr * (1 - smooth))
            let smoothed = (self.previous_frame[k] * self.smoothing_time_constant) 
                         + (clamped * (1.0 - self.smoothing_time_constant));
            
            self.previous_frame[k] = smoothed;
            output.push(smoothed);
        }

        output
    }
}