// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-late

// This part is automatically included in the effect's source during the build process.
// The code below is called whenever a window is closed or opened.

effect.setUniform(this.shader, 'uSeed', [Math.random(), Math.random()]);
