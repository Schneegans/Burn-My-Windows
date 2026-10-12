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

// SPDX-FileCopyrightText: Kevin Langman <klangman@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import * as utils from '../utils.js';

// We import some modules only in the Shell process as they are not available in the
// preferences process. They are used only in the creator function of the ShaderFactory
// which is only called within GNOME Shell's process.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');
const LayeredEffect = await utils.importInShellOnly('./LayeredEffect.js');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// Morph: the area where the window appears morphs into the window. Both are warped     //
// (by a shared procedural "liquid flow" field, or each along the edges of its own      //
// image for "melt") and cross-dissolved. Shader: resources/shaders/morph.frag.         //
// Uses the standard layers of LayeredEffect.js:                                        //
//   surface = wallpaper and the windows behind, flattened by the offscreen effect and  //
//             warped as one image (a following shader, uLayer 0)                       //
//   window  = a clone of the window itself (extension.js's shader, uLayer 1)           //
//   above   = clones of the windows above the window (no shader)                       //
//////////////////////////////////////////////////////////////////////////////////////////

// px around the frame covered by the layers: must exceed the shader's SPILL_PX + FLOW_PX
// + RADIAL_PX + BLUR_PX so nothing is cut off.
const MORPH_MARGIN = 160;

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
export default class Effect {

  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.frag. The callback will be called for each
  // newly created shader instance.
  constructor() {
    this.shaderFactory = new ShaderFactory(Effect.getNick(), (shader) => {
      // Store uniform locations of newly created shaders.
      shader._uFrameRect = shader.get_uniform_location('uFrameRect');
      shader._uSeed      = shader.get_uniform_location('uSeed');
      shader._uStyle     = shader.get_uniform_location('uStyle');
      shader._uStrength  = shader.get_uniform_location('uStrength');
    });
  }

  // -------------------------------------------------------------- API for extension.js

  // Called by extension.js instead of its usual set-up; see src/LayeredEffect.js.
  createLayers(actor, shader, ctx) {
    // Same random flow field, dissolve pattern and style on both layers.
    const seed     = ctx.testMode ? [0, 0] : [Math.random(), Math.random()];
    const style    = ctx.settings.get_int('morph-style');
    const strength = ctx.settings.get_double('morph-strength');

    return LayeredEffect.create(actor, shader, ctx, {
      factory: this.shaderFactory,

      // The surface is opaque, so the window drawn over it at alpha a is exactly a
      // cross-dissolve, and the warp never shows the real screen through it.
      opaqueSurface: true,

      // The morph spills MORPH_MARGIN px beyond the frame.
      geometry: (frame) => ({
        cover: [{
          x: frame.x - MORPH_MARGIN,
          y: frame.y - MORPH_MARGIN,
          width: frame.width + 2 * MORPH_MARGIN,
          height: frame.height + 2 * MORPH_MARGIN
        }]
      }),

      init: (s) => {
        s.set_uniform_float(s._uSeed, 2, seed);
        s.set_uniform_float(s._uStyle, 1, [style]);
        s.set_uniform_float(s._uStrength, 1, [strength]);
      },

      onGeometry: (s, g) => {
        s.set_uniform_float(s._uFrameRect, 4,
                            [g.frame.x, g.frame.y, g.frame.width, g.frame.height]);
      }
    });
  }

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-enable-effect'), and its animation time
  // (e.g. '*-animation-time').
  static getNick() {
    return 'morph';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Morph');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    dialog.bindAdjustment('morph-animation-time');
    dialog.bindComboRow('morph-style');
    dialog.bindAdjustment('morph-strength');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The window is never scaled: the layers (see src/LayeredEffect.js) cover everything
  // needed.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}
