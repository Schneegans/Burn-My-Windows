// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// This part is automatically included in the effect's source during the build process.
// The code below is called whenever a window is closed or opened.

let seed = [Math.random(), Math.random()];
effect.setUniform(this.shader, 'uSeed', seed);
