/**
 * Decides when to render fewer pixels. Feed it every frame's duration; it
 * answers with a lower pixel ratio when frames have been slow for a while,
 * and never raises it again, so it settles instead of oscillating.
 */
export class AdaptiveResolution {
  private frames = 0;
  private slow = 0;

  constructor(
    public ratio: number,
    /** Frames slower than this on average trigger a step down. */
    private readonly budget = 1 / 42,
    /** Frames ignored after each change, while shaders compile and textures upload. */
    private readonly settle = 45,
    /** Frames averaged for each decision. */
    private readonly window = 60,
    private readonly floor = 1,
    private readonly stepSize = 0.5,
  ) {}

  /** Returns the new ratio when it changes, otherwise null. */
  step(dt: number): number | null {
    if (this.ratio <= this.floor) return null;
    this.frames++;
    if (this.frames > this.settle) this.slow += dt;
    if (this.frames < this.settle + this.window) return null;
    const average = this.slow / this.window;
    this.slow = 0;
    if (average <= this.budget) {
      // Nothing changed, so nothing needs to settle: start the next window straight away.
      this.frames = this.settle;
      return null;
    }
    this.frames = 0;
    this.ratio = Math.max(this.floor, this.ratio - this.stepSize);
    return this.ratio;
  }
}
