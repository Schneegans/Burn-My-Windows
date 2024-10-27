// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// This part is automatically included in the effect's source during the build process.
// The code below is called whenever the user changes something in the configuration of
// the effect.

effect.setUniform(this.shader, 'uBlurAmount', effect.readConfig('Amount', 1.0));
effect.setUniform(this.shader, 'uBlurQuality', effect.readConfig('Quality', 1.0));
