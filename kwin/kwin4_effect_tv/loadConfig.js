loadConfig() {
  const defaultDuration = 400;
  const duration = effect.readConfig('Duration', defaultDuration) || defaultDuration;
  this.duration  = animationTime(duration);

  effect.setUniform(this.shader, 'uColor', effect.readConfig('Color', 'white'));
}