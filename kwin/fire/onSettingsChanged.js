// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// This part is automatically included in the effect's source during the build process.
// The code below is called whenever the user changes something in the configuration of
// the effect.

// clang-format off
effect.setUniform(this.shader, 'uDuration', this.duration * 0.001);
effect.setUniform(this.shader, 'uScale', effect.readConfig('Scale', 1.0));
effect.setUniform(this.shader, 'uMovementSpeed', effect.readConfig('MovementSpeed', 1.0));
effect.setUniform(this.shader, 'u3DNoise',effect.readConfig('3DNoise', true) ? 1.0 : 0.0);
effect.setUniform(this.shader, 'uRandomColor', effect.readConfig('RandomColor', true) ? 1.0 : 0.0);
effect.setUniform(this.shader, 'uGradient1', this.readRGBAConfig('Gradient1'));
effect.setUniform(this.shader, 'uGradient2', this.readRGBAConfig('Gradient2'));
effect.setUniform(this.shader, 'uGradient3', this.readRGBAConfig('Gradient3'));
effect.setUniform(this.shader, 'uGradient4', this.readRGBAConfig('Gradient4'));
effect.setUniform(this.shader, 'uGradient5', this.readRGBAConfig('Gradient5'));
// clang-format on
