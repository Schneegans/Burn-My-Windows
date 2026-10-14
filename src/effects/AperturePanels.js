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
// The window is split into a grid of panels (like the moving wall panels in the Portal //
// games) which flip over one after another, revealing the window on their back when it //
// opens and what was behind it when it closes.                                         //
//                                                                                      //
// Uses the standard layers of LayeredEffect.js, with a wall:                           //
//   wall    = the wallpaper (no shader); black with the "Black Void" backdrop          //
//   surface = the panels' front: the windows behind (uLayer = 0), and the wallpaper   //
//             with the "Black Void" backdrop                                           //
//   window  = the panels' back: a clone of the window itself (uLayer = 1)              //
//   above   = clones of the windows above the window (no shader)                       //
// See resources/shaders/aperture-panels.frag.                                          //
//////////////////////////////////////////////////////////////////////////////////////////

// Values of the aperture-panels-wave-shape, -flip-axis and -backdrop settings (wave
// shapes 0-4 are described in aperture-panels.frag). More tunables live at the top of
// resources/shaders/aperture-panels.frag.
const WAVE_SHAPE_RANDOM    = 5;
const FLIP_AXIS_VERTICAL   = 0;
const FLIP_AXIS_RANDOM     = 2;
const BACKDROP_BLACK_VOID  = 1;
const BACKDROP_TRANSPARENT = 2;

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
      shader._uFrame        = shader.get_uniform_location('uFrame');
      shader._uCell         = shader.get_uniform_location('uCell');
      shader._uWaveShape    = shader.get_uniform_location('uWaveShape');
      shader._uVerticalAxis = shader.get_uniform_location('uVerticalAxis');
      shader._uBorderStyle  = shader.get_uniform_location('uBorderStyle');
      shader._uBorderColor  = shader.get_uniform_location('uBorderColor');
      shader._uBlackVoid    = shader.get_uniform_location('uBlackVoid');
    });
  }

  // -------------------------------------------------------------- API for extension.js

  // Called by extension.js instead of its usual set-up; see src/LayeredEffect.js.
  createLayers(actor, shader, ctx) {
    const settings = ctx.settings;

    // Target panel size in pixels; adjusted so the grid fits the window exactly.
    const panelSize = Math.max(1, settings.get_int('aperture-panels-panel-size'));

    // Backdrop: what shows behind the panels as they turn. "Wallpaper": the wallpaper
    // stays on the wall and only the windows behind are painted on the panels. "Black
    // Void": the wallpaper is painted on the panels too, so it flips with them and the
    // wall is black.
    const blackVoid =
      settings.get_int('aperture-panels-backdrop') === BACKDROP_BLACK_VOID;
    // "Transparent": no wall and no wallpaper; the real screen shows through the gaps.
    const transparent =
      settings.get_int('aperture-panels-backdrop') === BACKDROP_TRANSPARENT;

    // The user's settings, read once: both shaders must get the same values, including
    // the same pick for the "Random" options.
    let waveShape = settings.get_int('aperture-panels-wave-shape');
    if (waveShape === WAVE_SHAPE_RANDOM) {
      waveShape = ctx.testMode ? 0 : Math.floor(Math.random() * WAVE_SHAPE_RANDOM);
    }
    let flipAxis = settings.get_int('aperture-panels-flip-axis');
    if (flipAxis === FLIP_AXIS_RANDOM) {
      flipAxis = ctx.testMode ? 0 : Math.floor(Math.random() * FLIP_AXIS_RANDOM);
    }
    const borderStyle = settings.get_int('aperture-panels-border-style');
    const borderColor =
      utils.parseColor(settings.get_string('aperture-panels-border-color'));

    return LayeredEffect.create(actor, shader, ctx, {
      factory: this.shaderFactory,
      wall: !transparent,  // shows through the gaps between the turning panels
      desktopOnWall: !blackVoid && !transparent,
      noWallpaper: transparent,

      // A grid over the visible window only, with a panel size that divides it exactly.
      geometry: (frame) => {
        const cols = Math.max(1, Math.round(frame.width / panelSize));
        const rows = Math.max(1, Math.round(frame.height / panelSize));
        return {cellW: frame.width / cols, cellH: frame.height / rows};
      },

      init: (s) => {
        s.set_uniform_float(s._uWaveShape, 1, [waveShape]);
        s.set_uniform_float(s._uVerticalAxis, 1,
                            [flipAxis === FLIP_AXIS_VERTICAL ? 1 : 0]);
        s.set_uniform_float(s._uBorderStyle, 1, [borderStyle]);
        s.set_uniform_float(s._uBorderColor, 4, borderColor);
        s.set_uniform_float(s._uBlackVoid, 1, [blackVoid ? 1 : 0]);
      },

      onGeometry: (s, g) => {
        s.set_uniform_float(s._uFrame, 4,
                            [g.frame.x, g.frame.y, g.frame.width, g.frame.height]);
        s.set_uniform_float(s._uCell, 2, [g.cellW, g.cellH]);
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
    return 'aperture-panels';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Aperture Panels');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    dialog.bindAdjustment('aperture-panels-animation-time');
    dialog.bindAdjustment('aperture-panels-panel-size');
    dialog.bindComboRow('aperture-panels-wave-shape');
    dialog.bindComboRow('aperture-panels-flip-axis');
    dialog.bindComboRow('aperture-panels-backdrop');
    dialog.bindComboRow('aperture-panels-border-style');
    dialog.bindColorButton('aperture-panels-border-color');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The window is never scaled: the layers (see src/LayeredEffect.js) cover everything
  // needed.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}
