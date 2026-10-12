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
// Wormhole: the desktop is sucked into the screen around the window's centre, down     //
// a tube into a dark void. Then the tube's floor rises, flattening the desktop again   //
// and pushing the window (painted on the same warped surface) out of the void to its   //
// real size. Closing plays it backwards. Shader: resources/shaders/wormhole.frag.      //
// Uses the standard layers of LayeredEffect.js:                                        //
//   surface = wallpaper and the windows behind, flattened by the offscreen effect and  //
//             warped as one image (a following shader, uLayer 0)                       //
//   window  = a clone of the window itself (extension.js's shader, uLayer 1)           //
//   above   = clones of the windows above the window (no shader)                       //
//////////////////////////////////////////////////////////////////////////////////////////

// More tunables (depth, timeline, shading) live at the top of
// resources/shaders/wormhole.frag.
const FUNNEL_EXTRA =
  80;  // funnel semi-axes: half the visible window x funnel size, plus this many px

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
      shader._uCenter      = shader.get_uniform_location('uCenter');
      shader._uAxes        = shader.get_uniform_location('uAxes');
      shader._uFrameHalf   = shader.get_uniform_location('uFrameHalf');
      shader._uVoidSize    = shader.get_uniform_location('uVoidSize');
      shader._uTunnelDepth = shader.get_uniform_location('uTunnelDepth');
      shader._uBounce      = shader.get_uniform_location('uBounce');
    });
  }

  // -------------------------------------------------------------- API for extension.js

  // Called by extension.js instead of its usual set-up; see src/LayeredEffect.js.
  createLayers(actor, shader, ctx) {
    // The user's settings, read once so both layers get the same values.
    const funnelSize  = ctx.settings.get_double('wormhole-funnel-size');
    const voidSize    = ctx.settings.get_double('wormhole-void-size');
    const tunnelDepth = ctx.settings.get_double('wormhole-tunnel-depth');
    const bounce      = ctx.settings.get_double('wormhole-bounce');

    return LayeredEffect.create(actor, shader, ctx, {
      factory: this.shaderFactory,

      // The surface is opaque (black under the wallpaper) so the hole and anything the
      // warp reveals never show the real screen through it.
      opaqueSurface: true,

      // Funnel: centred on the visible window, bigger than it, but symmetric around the
      // centre and never beyond the screen (so the sheet is flat where the layer ends).
      geometry: (frame, act, SW, SH) => {
        const cx = frame.x + frame.width / 2;
        const cy = frame.y + frame.height / 2;
        const ax =
          Math.max(8, Math.min(frame.width / 2 * funnelSize + FUNNEL_EXTRA, cx, SW - cx));
        const ay = Math.max(
          8, Math.min(frame.height / 2 * funnelSize + FUNNEL_EXTRA, cy, SH - cy));
        return {
          cover: [{x: cx - ax, y: cy - ay, width: 2 * ax, height: 2 * ay}],
          cx,
          cy,
          ax,
          ay
        };
      },

      init: (s) => {
        s.set_uniform_float(s._uVoidSize, 1, [voidSize]);
        s.set_uniform_float(s._uTunnelDepth, 1, [tunnelDepth]);
        s.set_uniform_float(s._uBounce, 1, [bounce]);
      },

      onGeometry: (s, g) => {
        s.set_uniform_float(s._uCenter, 2, [g.cx - g.ox, g.cy - g.oy]);
        s.set_uniform_float(s._uAxes, 2, [g.ax, g.ay]);
        s.set_uniform_float(s._uFrameHalf, 2, [g.frame.width / 2, g.frame.height / 2]);
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
    return 'wormhole';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Wormhole');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    dialog.bindAdjustment('wormhole-animation-time');
    dialog.bindAdjustment('wormhole-void-size');
    dialog.bindAdjustment('wormhole-tunnel-depth');
    dialog.bindAdjustment('wormhole-funnel-size');
    dialog.bindAdjustment('wormhole-bounce');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The window is never scaled: the layers (see src/LayeredEffect.js) cover everything
  // needed.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}
