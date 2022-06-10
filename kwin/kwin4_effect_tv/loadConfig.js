loadConfig() {
  this.duration = animationTime(effect.readConfig('Duration', 1000));
  effect.setUniform(this.shader, 'uColor', effect.readConfig('Color', 'white'));
}