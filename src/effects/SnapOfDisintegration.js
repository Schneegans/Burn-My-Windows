//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

const GObject = imports.gi.GObject;

const _ = imports.gettext.domain('burn-my-windows').gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;
const ShaderFactory  = Me.imports.src.ShaderFactory.ShaderFactory;

//////////////////////////////////////////////////////////////////////////////////////////
// This effects dissolves your windows into a cloud of dust. For this, it uses an       //
// approach similar to the Broken Glass effect. A dust texture is used to segment the   //
// window texture into a set of layers. Each layer is then moved, sheared and scaled    //
// randomly. Just a few layers are sufficient to create the illusion of many individual //
// dust particles.                                                                      //
// This effect is not available on GNOME 3.3x, due to the limitation described in the   //
// documentation of vfunc_paint_target further down in this file.                       //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var SnapOfDisintegration = class {

  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.
  constructor() {
    this.shaderFactory = new ShaderFactory(this.getNick(), (shader) => {
      // We import these modules in this function as they are not available in the
      // preferences process. This callback is only called within GNOME Shell's process.
      const {Clutter, GdkPixbuf, Cogl} = imports.gi;

      // Create the texture in the first call.
      if (!this._dustTexture) {
        const dustData    = GdkPixbuf.Pixbuf.new_from_resource('/img/dust.png');
        this._dustTexture = new Clutter.Image();
        this._dustTexture.set_data(dustData.get_pixels(), Cogl.PixelFormat.RGB_888,
                                   dustData.width, dustData.height, dustData.rowstride);
      }

      // Store uniform locations of newly created shaders.
      shader._uDustTexture = shader.get_uniform_location('uDustTexture');
      shader._uDustColor   = shader.get_uniform_location('uDustColor');
      shader._uSeed        = shader.get_uniform_location('uSeed');
      shader._uDustScale   = shader.get_uniform_location('uDustScale');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings, forOpening, testMode) => {
        // The dust particles will fade to this color over time.
        const c = Clutter.Color.from_string(settings.get_string('snap-color'))[1];

        // clang-format off
        shader.set_uniform_float(shader._uDustColor, 4, [c.red / 255, c.green / 255, c.blue / 255, c.alpha / 255]);
        shader.set_uniform_float(shader._uSeed,      2, [testMode ? 0 : Math.random(), testMode ? 0 : Math.random()]);
        shader.set_uniform_float(shader._uDustScale, 1, [settings.get_double('snap-scale')]);
        // clang-format on
      });

      // This is required to bind the dust texture for drawing. Sadly, this seems to be
      // impossible under GNOME 3.3x as this.get_pipeline() is not available. It was
      // called get_target() back then but this is not wrapped in GJS.
      // https://gitlab.gnome.org/GNOME/mutter/-/blob/gnome-3-36/clutter/clutter/clutter-offscreen-effect.c#L598
      shader.connect('update-animation', (shader) => {
        const pipeline = shader.get_pipeline();

        // Use linear filtering for the window texture.
        pipeline.set_layer_filters(0, Cogl.PipelineFilter.LINEAR,
                                   Cogl.PipelineFilter.LINEAR);

        // Bind the dust texture.
        pipeline.set_layer_texture(1, this._dustTexture.get_texture());
        pipeline.set_layer_wrap_mode(1, Cogl.PipelineWrapMode.REPEAT);
        pipeline.set_uniform_1i(shader._uDustTexture, 1);
      });
    });
  }

  // ---------------------------------------------------------------------------- metadata

  // This effect is only available on GNOME Shell 40+.
  getMinShellVersion() {
    return [40, 0];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-enable-effect'), and its animation time
  // (e.g. '*-animation-time').
  getNick() {
    return 'snap';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Snap of Disintegration');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  bindPreferences(dialog) {
    dialog.bindAdjustment('snap-animation-time');
    dialog.bindAdjustment('snap-scale');
    dialog.bindColorButton('snap-color');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  getActorScale(settings) {
    return {x: 1.2, y: 1.2};
  }
}
