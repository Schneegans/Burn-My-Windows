// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// This part is automatically included in the effect's source during the build process.
// The code below is called whenever the user changes something in the configuration of
// the effect.

// I have not yet found a way to scaling the actor canvas on KWin. So this effect cannot
// look as good as on GNOME.
effect.setUniform(this.shader, 'uActorScale', 1.0);

effect.setUniform(this.shader, 'uHorizontalScale',
                  effect.readConfig('HorizontalScale', 1.0));
effect.setUniform(this.shader, 'uVerticalScale', effect.readConfig('VerticalScale', 1.0));
effect.setUniform(this.shader, 'uPixelSize', effect.readConfig('PixelSize', 1.0));
