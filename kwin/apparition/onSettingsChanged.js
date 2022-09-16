// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// This part is automatically included in the effect's source during the build process.
// The code below is called whenever the user changes something in the configuration of
// the effect.

effect.setUniform(this.shader, 'uShake', effect.readConfig('Shake', 1.0));
effect.setUniform(this.shader, 'uTwirl', effect.readConfig('Twirl', 1.0));
effect.setUniform(this.shader, 'uSuction', effect.readConfig('Suction', 1.0));
effect.setUniform(this.shader, 'uRandomness', effect.readConfig('Randomness', 1.0));
