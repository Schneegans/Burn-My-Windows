// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// This part is automatically included in the effect's source during the build process.
// The code below is called whenever the user changes something in the configuration of
// the effect.

effect.setUniform(this.shader, 'uAdditiveBlending',
                  effect.readConfig('AdditiveBlending', true) ? 1.0 : 0.0);
effect.setUniform(this.shader, 'uScale', effect.readConfig('Scale', 1.0));
effect.setUniform(this.shader, 'uLineWidth', effect.readConfig('LineWidth', 1.0));
effect.setUniform(this.shader, 'uGlowColor', this.readRGBAConfig('GlowColor'));
effect.setUniform(this.shader, 'uLineColor', this.readRGBAConfig('LineColor'));
