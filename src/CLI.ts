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
    console.log(`\n 🍰 \x1b[1m\x1b[35mTIRAMISU\x1b[0m \x1b[2m| Starting Render Engine\x1b[0m\n`);
  }

  public update(currentFrame: number) {
    const elapsed = (performance.now() - this.startTime) / 1000;
    const progress = currentFrame / this.totalFrames;
    const percent = Math.round(progress * 100);
    
    const filled = Math.floor(progress * this.barWidth);
    const empty = this.barWidth - filled;
    const bar = `\x1b[35m${"█".repeat(filled)}\x1b[0m\x1b[2m${"░".repeat(empty)}\x1b[0m`;

    const fps = currentFrame > 0 ? (currentFrame / elapsed).toFixed(1) : "0.0";
    const eta = currentFrame > 0 
        ? ((elapsed / currentFrame) * (this.totalFrames - currentFrame)).toFixed(1) 
        : "??";

    process.stdout.write(
      `\r  ${bar} \x1b[1m${percent}%\x1b[0m | ` +
      `Frame: \x1b[36m${currentFrame}\x1b[0m/\x1b[2m${this.totalFrames}\x1b[0m | ` +
      `Speed: \x1b[33m${fps}fps\x1b[0m | ` +
      `ETA: \x1b[32m${eta}s\x1b[0m `
    );
  }

  public finish(outputFile: string) {
    const totalTime = ((performance.now() - this.startTime) / 1000).toFixed(2);
    process.stdout.write("\x1B[?25h"); // Show cursor
    console.log(`\n\n ✨ \x1b[1m\x1b[32mRender Complete!\x1b[0m`);
    console.log(` 📂 Output: \x1b[4m${outputFile}\x1b[0m`);
    console.log(` ⏱️  Time:   \x1b[1m${totalTime}s\x1b[0m\n`);
  }
}