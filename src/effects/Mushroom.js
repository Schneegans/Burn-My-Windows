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

// SPDX-FileCopyrightText: Justin Garza JGarza9788@gmail.com
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

// Import the Gio module from the GNOME platform (GObject Introspection).
// This module provides APIs for I/O operations, settings management, and other core
// features.
import Gio from 'gi://Gio';

// Import utility functions from the local utils.js file.
// These utilities likely contain helper functions or shared logic used across the
// application.
import * as utils from '../utils.js';

// We import the ShaderFactory only in the Shell process as it is not required in the
// preferences process. The preferences process does not create any shader instances, it
// only uses the static metadata of the effect.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// This effect is inspired by the old 8bit mario video games and the New Super Mario //
// Bros 2 specifically when mario gets the mushroom. i hope you enjoy this little blast //
// from the past. //
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
      // very basic effect... so nothing here

      shader._uGradient = [
        shader.get_uniform_location('uStarColor0'),
        shader.get_uniform_location('uStarColor1'),
        shader.get_uniform_location('uStarColor2'),
        shader.get_uniform_location('uStarColor3'),
        shader.get_uniform_location('uStarColor4'),
        shader.get_uniform_location('uStarColor5'),
      ];


      shader._uScaleStyle = shader.get_uniform_location('uScaleStyle');

      shader._uSparkCount    = shader.get_uniform_location('uSparkCount');
      shader._uSparkColor    = shader.get_uniform_location('uSparkColor');
      shader._uSparkRotation = shader.get_uniform_location('uSparkRotation');

      shader._uRaysColor = shader.get_uniform_location('uRaysColor');

      shader._uRingCount    = shader.get_uniform_location('uRingCount');
      shader._uRingRotation = shader.get_uniform_location('uRingRotation');
      shader._uStarCount    = shader.get_uniform_location('uStarCount');

      shader._uSeed = shader.get_uniform_location('uSeed');

      // And update all uniforms at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        for (let i = 0; i <= 5; i++) {
          shader.set_uniform_float(
            shader._uGradient[i], 4,
            utils.parseColor(settings.get_string('mushroom-star-color-' + i)));
        }

        // clang-format off
        shader.set_uniform_float(shader._uScaleStyle,    1, [settings.get_double('mushroom-scale-style')]);
        shader.set_uniform_float(shader._uSparkCount,    1, [settings.get_int('mushroom-spark-count')]);
        shader.set_uniform_float(shader._uSparkColor,    4, utils.parseColor(settings.get_string('mushroom-spark-color')));
        shader.set_uniform_float(shader._uSparkRotation, 1, [settings.get_double('mushroom-spark-rotation')]);
        shader.set_uniform_float(shader._uRaysColor,     4, utils.parseColor(settings.get_string('mushroom-rays-color')));
        shader.set_uniform_float(shader._uRingCount,     1, [settings.get_int('mushroom-ring-count')]);
        shader.set_uniform_float(shader._uRingRotation,  1, [settings.get_double('mushroom-ring-rotation')]);
        shader.set_uniform_float(shader._uStarCount,     1, [settings.get_int('mushroom-star-count')]);

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
    return 'mushroom';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Mushroom');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    // Empty for now... Code is added here later in the tutorial!
    dialog.bindAdjustment('mushroom-animation-time');
    // dialog.bindSwitch('mushroom-8bit-enable');

    dialog.bindAdjustment('mushroom-scale-style');

    dialog.bindAdjustment('mushroom-spark-count');
    dialog.bindColorButton('mushroom-spark-color');
    dialog.bindAdjustment('mushroom-spark-rotation');

    dialog.bindColorButton('mushroom-rays-color');

    dialog.bindAdjustment('mushroom-ring-count');
    dialog.bindAdjustment('mushroom-ring-rotation');
    dialog.bindAdjustment('mushroom-star-count');

    dialog.bindColorButton('mushroom-star-color-0');
    dialog.bindColorButton('mushroom-star-color-1');
    dialog.bindColorButton('mushroom-star-color-2');
    dialog.bindColorButton('mushroom-star-color-3');
    dialog.bindColorButton('mushroom-star-color-4');
    dialog.bindColorButton('mushroom-star-color-5');


    // Ensure the button connections and other bindings happen only once,
    // even if the bindPreferences function is called multiple times.
    if (!Effect._isConnected) {
      Effect._isConnected = true;

      // Bind the "reset-star-colors" button to reset all star colors to their default
      // values.
      dialog.getBuilder().get_object('reset-star-colors').connect('clicked', () => {
        // Reset each mushroom star color setting.
        dialog.getProfileSettings().reset('mushroom-star-color-0');
        dialog.getProfileSettings().reset('mushroom-star-color-1');
        dialog.getProfileSettings().reset('mushroom-star-color-2');
        dialog.getProfileSettings().reset('mushroom-star-color-3');
        dialog.getProfileSettings().reset('mushroom-star-color-4');
        dialog.getProfileSettings().reset('mushroom-star-color-5');
      });


      // Initialize the preset dropdown menu for mushroom star colors.
      Effect._createMushroomPresets(dialog);
    }
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }

  // ---------------------------------------------------------------- Presets

  // This function initializes the preset dropdown menu for configuring fire options.
  // It defines multiple color presets for the "mushroom star" effect and sets up
  // the logic to apply these presets when selected.

  static _createMushroomPresets(dialog) {
    // Retrieve the builder object for the dialog and connect to the "realize" event of
    // the button.
    dialog.getBuilder()
      .get_object('mushroom-star-color-preset-button')
      .connect('realize', (widget) => {
        // Define an array of color presets, each with a name and six color values (RGBA
        // format).
        const presets = [
          {
            name: _('8Bit Plumber'),
            ScaleStyle: 0.0,
            SparkCount: 0,
            SparkColor: 'rgba(255,255,255,0.0)',
            SparkRotation: 0.33,
            RayColor: 'rgba(255,255,255,0.0)',
            RingCount: 0,
            RingRotation: 0.0,
            StarCount: 0,
            color0: 'rgba(233,249,0,1.0)',
            color1: 'rgba(233,249,0,1.0)',
            color2: 'rgba(91,255,0,1.0)',
            color3: 'rgba(91,255,0,1.0)',
            color4: 'rgba(0,240,236,1.0)',
            color5: 'rgba(0,240,236,1.0)',
          },
          {
            name: _('New Bros 2 🍄'),
            ScaleStyle: 1.0,
            SparkCount: 4,
            SparkColor: 'rgba(255,255,255,1.0)',
            SparkRotation: 0.3,
            RayColor: 'rgba(255,255,255,1.0)',
            RingCount: 3,
            RingRotation: 1.33,
            StarCount: 5,
            color0: 'rgba(233,249,0,1.0)',
            color1: 'rgba(233,249,0,1.0)',
            color2: 'rgba(91,255,0,1.0)',
            color3: 'rgba(91,255,0,1.0)',
            color4: 'rgba(0,240,236,1.0)',
            color5: 'rgba(0,240,236,1.0)',
          },
          {
            name:
              _('Red White and Blue 🇺🇸'),  // A patriotic palette of red, white, and blue
            ScaleStyle: 1.0,
            SparkCount: 4,
            SparkColor: 'rgba(255,255,255,1.0)',
            SparkRotation: 0.3,
            RayColor: 'rgba(255,255,255,0.0)',
            RingCount: 3,
            RingRotation: 1.33,
            StarCount: 5,
            color0: 'rgba(255, 0, 0, 1.0)',
            color1: 'rgba(255, 0, 0, 1.0)',
            color2: 'rgba(255,255,255, 1.0)',
            color3: 'rgba(255,255,255, 1.0)',
            color4: 'rgba(0,0,255, 1.0)',
            color5: 'rgba(0,0,255, 1.0)'
          },
          {
            name: _('Rainbow 🌈'),  // A vivid rainbow spectrum of colors
            ScaleStyle: 1.0,
            SparkCount: 4,
            SparkColor: 'rgba(255,255,255,1.0)',
            SparkRotation: 0.3,
            RayColor: 'rgba(255,255,255,0.0)',
            RingCount: 3,
            RingRotation: 2.0,
            StarCount: 7,
            color0: 'rgba(255, 69, 58, 1.0)',   // Bold Red
            color1: 'rgba(255, 140, 0, 1.0)',   // Bold Orange
            color2: 'rgba(255, 223, 0, 1.0)',   // Bold Yellow
            color3: 'rgba(50, 205, 50, 1.0)',   // Bold Green
            color4: 'rgba(30, 144, 255, 1.0)',  // Bold Blue
            color5: 'rgba(148, 0, 211, 1.0)'    // Bold Purple
          },
          {
            name: _('Cattuccino 😺'),  // A soft pastel palette inspired by a
                                       // cappuccino theme
            ScaleStyle: 1.0,
            SparkCount: 4,
            SparkColor: 'rgba(255,255,255,1.0)',
            SparkRotation: 0.3,
            RayColor: 'rgba(255,255,255,0.0)',
            RingCount: 3,
            RingRotation: 2.0,
            StarCount: 7,
            color0: 'rgba(239, 146, 160, 1.0)',
            color1: 'rgba(246, 178, 138, 1.0)',
            color2: 'rgba(240, 217, 169, 1.0)',
            color3: 'rgba(175, 223, 159, 1.0)',
            color4: 'rgba(149, 182, 246, 1.0)',
            color5: 'rgba(205, 170, 247, 1.0)'
          },
          {
            name: _('Dracula 🦇'),  // A dark palette inspired by the Dracula theme
            ScaleStyle: 1.0,
            SparkCount: 0,
            SparkColor: 'rgba(255,255,255,1.0)',
            SparkRotation: 0.3,
            RayColor: 'rgba(255,255,255,0.0)',
            RingCount: 3,
            RingRotation: 2.0,
            StarCount: 7,
            color0: 'rgba(40, 42, 54, 1.0)',   // Dark Grey
            color1: 'rgba(68, 71, 90, 1.0)',   // Medium Grey
            color2: 'rgba(90, 94, 119, 1.0)',  // Light Grey
            color3: 'rgba(90, 94, 119, 1.0)',  // Light Grey
            color4: 'rgba(68, 71, 90, 1.0)',   // Medium Grey
            color5: 'rgba(40, 42, 54, 1.0)'    // Dark Grey
          },
          {
            name: _('Sparkle ✨'),  // A dark palette inspired by the Dracula theme
            ScaleStyle: 1.0,
            SparkCount: 25,
            SparkColor: 'rgba(255,255,255,1.0)',
            SparkRotation: 0.3,
            RayColor: 'rgba(255,255,255,0.0)',
            RingCount: 0,
            RingRotation: 1.33,
            StarCount: 7,
            color0: 'rgba(255,255,255,0.0)',
            color1: 'rgba(255,255,255,0.0)',
            color2: 'rgba(255,255,255,0.0)',
            color3: 'rgba(255,255,255,0.0)',
            color4: 'rgba(255,255,255,0.0)',
            color5: 'rgba(255,255,255,0.0)',
          }
        ];

        // Create a new menu model to hold the presets and an action group for handling
        // selections.
        const menu      = Gio.Menu.new();
        const group     = Gio.SimpleActionGroup.new();
        const groupName = 'mushroom-presets';

        // Iterate over the presets to populate the menu.
        presets.forEach((preset, i) => {
          // Define an action name based on the preset index.
          const actionName = 'mushroom' + i;

          // Append the preset name to the menu.
          menu.append(preset.name, groupName + '.' + actionName);

          // Create a new action for the preset.
          let action = Gio.SimpleAction.new(actionName, null);

          // Connect the action to a function that loads the preset colors into the
          // dialog.
          action.connect('activate', () => {
            dialog.getProfileSettings().set_double('mushroom-scale-style',
                                                   preset.ScaleStyle);
            dialog.getProfileSettings().set_int('mushroom-spark-count',
                                                preset.SparkCount);
            dialog.getProfileSettings().set_string('mushroom-spark-color',
                                                   preset.SparkColor);
            dialog.getProfileSettings().set_double('mushroom-spark-rotation',
                                                   preset.SparkRotation);
            dialog.getProfileSettings().set_string('mushroom-rays-color',
                                                   preset.RayColor);
            dialog.getProfileSettings().set_int('mushroom-ring-count', preset.RingCount);
            dialog.getProfileSettings().set_double('mushroom-ring-rotation',
                                                   preset.RingRotation);
            dialog.getProfileSettings().set_int('mushroom-star-count', preset.StarCount);

            dialog.getProfileSettings().set_string('mushroom-star-color-0',
                                                   preset.color0);
            dialog.getProfileSettings().set_string('mushroom-star-color-1',
                                                   preset.color1);
            dialog.getProfileSettings().set_string('mushroom-star-color-2',
                                                   preset.color2);
            dialog.getProfileSettings().set_string('mushroom-star-color-3',
                                                   preset.color3);
            dialog.getProfileSettings().set_string('mushroom-star-color-4',
                                                   preset.color4);
            dialog.getProfileSettings().set_string('mushroom-star-color-5',
                                                   preset.color5);
          });

          // Add the action to the action group.
          group.add_action(action);
        });

        // Assign the populated menu to the preset button.
        dialog.getBuilder()
          .get_object('mushroom-star-color-preset-button')
          .set_menu_model(menu);

        // Insert the action group into the root widget for handling the presets.
        const root = widget.get_root();
        root.insert_action_group(groupName, group);
      });
  }
}
