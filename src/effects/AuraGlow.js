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

// SPDX-FileCopyrightText: Justin Garza <JGarza9788@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

import * as utils from '../utils.js';

// We import the ShaderFactory only in the Shell process as it is not required in the
// preferences process. The preferences process does not create any shader instances, it
// only uses the static metadata of the effect.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// This effect was inspired by apple's new siri effect.                                 //
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
export default class Effect {
  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.


  constructor() {
    this.shaderFactory = new ShaderFactory(Effect.getNick(), (shader) => {
      // Store uniform locations of newly created shaders.
      shader._uColorSpeed        = shader.get_uniform_location('uColorSpeed');
      shader._uRandomColorOffset = shader.get_uniform_location('uRandomColorOffset');
      shader._uColorOffset       = shader.get_uniform_location('uColorOffset');
      shader._uColorSaturation   = shader.get_uniform_location('uColorSaturation');

      shader._uEdgeSize     = shader.get_uniform_location('uEdgeSize');
      shader._uEdgeShape    = shader.get_uniform_location('uEdgeShape');
      shader._uEdgeHardness = shader.get_uniform_location('uEdgeHardness');

      shader._uBlur    = shader.get_uniform_location('uBlur');
      shader._uFadeOut = shader.get_uniform_location('uFadeOut');
      shader._uSeed    = shader.get_uniform_location('uSeed');


      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        shader.set_uniform_float(shader._uColorSpeed, 1, [
          settings.get_double('aura-glow-color-speed'),
        ]);

        shader.set_uniform_float(shader._uRandomColorOffset, 1,
                                 [settings.get_boolean('aura-glow-random-color')]);

        shader.set_uniform_float(shader._uColorOffset, 1, [
          settings.get_double('aura-glow-color-offset'),
        ]);

        shader.set_uniform_float(shader._uColorSaturation, 1, [
          settings.get_double('aura-glow-color-saturation'),
        ]);

        shader.set_uniform_float(shader._uEdgeSize, 1, [
          settings.get_double('aura-glow-edge-size'),
        ]);
        shader.set_uniform_float(shader._uEdgeShape, 1, [
          settings.get_double('aura-glow-edge-shape'),
        ]);
        shader.set_uniform_float(shader._uEdgeHardness, 1, [
          settings.get_double('aura-glow-edge-hardness'),
        ]);

        shader.set_uniform_float(shader._uBlur, 1, [
          settings.get_double('aura-glow-blur'),
        ]);

        shader.set_uniform_float(shader._uFadeOut, 1, [
          settings.get_double('aura-glow-fade-out'),
        ]);

        // shader.set_uniform_float(shader._uLightTheme, 1, [
        //   Effect.getCurrentThemeMode(),
        // ]);

        // this will be used with a has function to get a random number
        // clang-format off
        shader.set_uniform_float(shader._uSeed,  2, [Math.random(), Math.random()]);
        // clang-format on
      });
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
  // (e.g. '*-animation-time'). Also, the shader file and the settings UI files should be
  // named likes this.
  static getNick() {
    return 'aura-glow';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Aura Glow');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    // Empty for now... Code is added here later in the tutorial!
    dialog.bindAdjustment('aura-glow-animation-time');
    dialog.bindAdjustment('aura-glow-color-speed');
    dialog.bindSwitch('aura-glow-random-color');
    dialog.bindAdjustment('aura-glow-color-offset');
    dialog.bindAdjustment('aura-glow-color-saturation');

    dialog.bindAdjustment('aura-glow-edge-size');
    dialog.bindAdjustment('aura-glow-edge-shape');
    dialog.bindAdjustment('aura-glow-edge-hardness');

    dialog.bindAdjustment('aura-glow-blur');
    dialog.bindAdjustment('aura-glow-fade-out');

    // enable and disable the one slider
    function EnableDisablePref(dialog, state) {
      dialog.getBuilder()
        .get_object('aura-glow-color-offset-scale')
        .set_sensitive(!state);
    }

    // if we use a checkbox instead of a switch
    /*
    const randColor = dialog.getBuilder().get_object('aura-glow-random-color');
    if (randColor) {
      // Connect to the "toggled" signal to update preferences dynamically
      randColor.connect('toggled', (widget) => {
        const state = widget.get_active();  // Retrieve the state directly
        EnableDisablePref(dialog, state);   // Update sensitivity when the state changes
      });

      // Manually call the update function on startup, using the initial state of the
      // switch
      const initialState =
        randColor.get_active();  // Get the initial state of the check button
      EnableDisablePref(dialog, initialState);
    } else {
      // Log an error if the switch widget is not found in the UI
      log('Error: \'aura-glow-random-color\' switch widget not found.');
    }
    */

    // if we use a switch instead of a checkbox
    
    const switchWidget = dialog.getBuilder().get_object('aura-glow-random-color');
    if (switchWidget) {
      // Connect to the "state-set" signal to update preferences dynamically based on
      // the switch state.
      switchWidget.connect('state-set', (widget, state) => {
        EnableDisablePref(dialog, state);  // Update sensitivity when the state changes.
      });

      // Manually call the update function on startup, using the initial state of the
      // switch.
      const initialState =
        switchWidget.get_active();  // Get the current state of the switch.
      EnableDisablePref(dialog, initialState);
    } else {
      // Log an error if the switch widget is not found in the UI.
      log('Error: \'aura-glow-random-color\' switch widget not found.');
    }
    

    // Retrieve the necessary objects
    const colorOffset = dialog.getBuilder().get_object('aura-glow-color-offset-scale');
    const actionRow   = dialog.getBuilder().get_object('aura-glow-action-row');

    if (colorOffset == null) {
      log('colorOffset is null');
    }


    // Define an array of color names based on the slider value
    const colorNames = [
      'Red',             // 0.00
      'Reddish-Orange',  // 0.05
      'Orange',          // 0.10
      'Yellow-Orange',   // 0.15
      'Yellow-Green',    // 0.20
      'Lime Green',      // 0.25
      'Green',           // 0.30
      'Greenish-Cyan',   // 0.35
      'Aqua',            // 0.40
      'Light Cyan',      // 0.45
      'Cyan',            // 0.50
      'Sky Cyan',        // 0.55
      'Sky Blue',        // 0.60
      'Light Blue',      // 0.65
      'Blue',            // 0.70
      'Indigo',          // 0.75
      'Purple',          // 0.80
      'Magenta',         // 0.85
      'Pinkish-Red',     // 0.90
      'Crimson',         // 0.95
      'Red'              // 1.00 (wraps around)
    ];

    // Function to update the subtitle based on the slider value
    const updateSubtitle = () => {
      const value = colorOffset.get_value();  // Get the current slider value
      const index = Math.round(value * 20);   // Map value [0.0, 1.0] to index [0, 10]
      actionRow.set_subtitle(
        colorNames[index]);  // Update subtitle with the corresponding color
    };

    // Connect the value-changed signal to the updateSubtitle function
    // Connect the value-changed signal to the updateSubtitle function
    colorOffset.connect('value-changed', updateSubtitle);

    // Initialize the subtitle on load
    updateSubtitle();
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}