loadConfig() {
  this.duration = animationTime(effect.readConfig('Duration', 1000));
  effect.setUniform(this.shader, 'uColor', effect.readConfig('Color', 'white'));
  effect.setUniform(this.shader, 'uScale', effect.readConfig('Scale', 1.0));
}