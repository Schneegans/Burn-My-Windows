loadConfig() {
  const defaultDuration = 2000;
  const duration = effect.readConfig('Duration', defaultDuration) || defaultDuration;
  this.duration  = animationTime(duration);

  effect.setUniform(this.shader, 'uColor', effect.readConfig('Color', 'white'));
  effect.setUniform(this.shader, 'uScale', effect.readConfig('Scale', 1.0));
}