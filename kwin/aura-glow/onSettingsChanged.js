// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// This part is automatically included in the effect's source during the build process.
// The code below is called whenever the user changes something in the configuration of
// the effect.

effect.setUniform(this.shader, 'uColorSpeed', effect.readConfig('Speed', 1.0));
effect.setUniform(this.shader, 'uRandomColorOffset', effect.readConfig('RandomColor', true) ? 1.0 : 0.0);
effect.setUniform(this.shader, 'uColorOffset', effect.readConfig('StartHue', 1.0));
effect.setUniform(this.shader, 'uColorSaturation', effect.readConfig('Saturation', 1.0));
effect.setUniform(this.shader, 'uBlur', effect.readConfig('BlurAmount', 1.0));
effect.setUniform(this.shader, 'uEdgeSize', effect.readConfig('EdgeSize', 1.0));
effect.setUniform(this.shader, 'uEdgeHardness', effect.readConfig('EdgeHardness', 1.0));
