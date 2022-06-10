// This part is automatically included in the effect's source during the build process.
// The code below is called whenever the user changes something in the configuration of
// the effect.

effect.setUniform(this.shader, 'uDuration', this.duration * 0.001);
effect.setUniform(this.shader, 'u3DNoise',
                  effect.readConfig('3DNoise', true) ? 1.0 : 0.0);
effect.setUniform(this.shader, 'uScale', effect.readConfig('Scale', 1.0));
effect.setUniform(this.shader, 'uMovementSpeed', effect.readConfig('MovementSpeed', 1.0));
effect.setUniform(this.shader, 'uGradient1', effect.readConfig('Gradient1', 'white'));
effect.setUniform(this.shader, 'uGradient2', effect.readConfig('Gradient2', 'white'));
effect.setUniform(this.shader, 'uGradient3', effect.readConfig('Gradient3', 'white'));
effect.setUniform(this.shader, 'uGradient4', effect.readConfig('Gradient4', 'white'));
effect.setUniform(this.shader, 'uGradient5', effect.readConfig('Gradient5', 'white'));
