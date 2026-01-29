export class TiramisuCLI {
  private startTime: number = 0;
  private totalFrames: number;
  private barWidth: number = 30;

  constructor(totalFrames: number) {
    this.totalFrames = totalFrames;
  }

  public start() {
    this.startTime = performance.now();
    process.stdout.write("\x1B[?25l"); // Hide cursor
    console.log(`\n🍰 Tiramisu Engine\n`);
  }

  public update(currentFrame: number) {
    const elapsed = (performance.now() - this.startTime) / 1000;
    const progress = Math.min(currentFrame / this.totalFrames, 1);
    const percent = Math.floor(progress * 100);
    
    const filled = Math.floor(progress * this.barWidth);
    const empty = this.barWidth - filled;
    const bar = `\x1b[35m${"█".repeat(filled)}\x1b[0m\x1b[90m${"░".repeat(empty)}\x1b[0m`;

    const eta = currentFrame > 0 
        ? ((elapsed / currentFrame) * (this.totalFrames - currentFrame)).toFixed(0) 
        : "--";

    const output = `  ${bar}  \x1b[1m${percent}%\x1b[0m  [${currentFrame}/${this.totalFrames}]  ETA: ${eta}s`;
    
    // Get terminal width to clamp string
    const terminalWidth = process.stdout.columns || 80;
    
    // \r returns to start, \x1b[K clears line
    process.stdout.write(`\r${output}`.substring(0, terminalWidth) + "\x1b[K");
  }

  public finish(outputFile: string) {
    const totalTime = ((performance.now() - this.startTime) / 1000).toFixed(1);
    process.stdout.write("\x1B[?25h"); // Show cursor
    process.stdout.write("\n\n");
    console.log(`✨ Rendered: \x1b[32m${outputFile}\x1b[0m in ${totalTime}s`);
  }
}