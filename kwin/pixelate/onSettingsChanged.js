// This part is automatically included in the effect's source during the build process.
// The code below is called whenever the user changes something in the configuration of
// the effect.

effect.setUniform(this.shader, 'uNoise', effect.readConfig('Noise', 1.0));
effect.setUniform(this.shader, 'uPixelSize', effect.readConfig('PixelSize', 1.0));
