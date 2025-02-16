// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// This part is automatically included in the effect's source during the build process.
// The code below is called whenever the user changes something in the configuration of
// the effect.

effect.setUniform(this.shader, 'uBrightness', effect.readConfig('Brightness', 1.0));
effect.setUniform(this.shader, 'uSpeedR', effect.readConfig('SpeedR', 1.0));
effect.setUniform(this.shader, 'uSpeedG', effect.readConfig('SpeedG', 1.0));
effect.setUniform(this.shader, 'uSpeedB', effect.readConfig('SpeedB', 1.0));
