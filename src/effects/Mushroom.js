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

import Gio from 'gi://Gio';

import * as utils from '../utils.js';

// We import the ShaderFactory only in the Shell process as it is not required in the
// preferences process. The preferences process does not create any shader instances, it
// only uses the static metadata of the effect.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// This effect was obviously inspired my the 8bit mario video games of old, specifically//
// when mario gets the mushroom. i hope you enjoy this little blast from the past.      //
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

      shader._u8BitStyle = shader.get_uniform_location('u8BitStyle');

      shader._uEnable4PStars = shader.get_uniform_location('uEnable4PStars');
      shader._u4PStars       = shader.get_uniform_location('u4PStars');
      shader._u4PSColor      = shader.get_uniform_location('u4PSColor');
      shader._u4PSRotation   = shader.get_uniform_location('u4PSRotation');

      shader._uEnableRays = shader.get_uniform_location('uEnableRays');
      shader._uRaysColor  = shader.get_uniform_location('uRaysColor');

      shader._uEnable5pStars = shader.get_uniform_location('uEnable5pStars');
      shader._uRings         = shader.get_uniform_location('uRings');
      shader._uRingRotation  = shader.get_uniform_location('uRingRotation');
      shader._uStarPerRing   = shader.get_uniform_location('uStarPerRing');

      // And update all uniforms at the start of each animation.
      shader.connect('begin-animation', (shader, settings) => {
        for (let i = 0; i <= 5; i++) {
          shader.set_uniform_float(
            shader._uGradient[i], 4,
            utils.parseColor(settings.get_string('mushroom-star-color-' + i)));
        }

        // clang-format off
        shader.set_uniform_float(shader._u8BitStyle,            1, [settings.get_boolean('mushroom-8bit-enable')]);

        shader.set_uniform_float(shader._uEnable4PStars,        1, [settings.get_boolean('mushroom-4pstars-enable')]);
        shader.set_uniform_float(shader._u4PStars,              1, [settings.get_int('mushroom-4pstars-count')]);
        shader.set_uniform_float(shader._u4PSColor,             4, utils.parseColor(settings.get_string('mushroom-4pstars-color')));
        shader.set_uniform_float(shader._u4PSRotation,          1, [settings.get_double('mushroom-4pstars-rotation')]);

        shader.set_uniform_float(shader._uEnableRays,           1, [settings.get_boolean('mushroom-rays-enable')]);
        shader.set_uniform_float(shader._uRaysColor,            4, utils.parseColor(settings.get_string('mushroom-rays-color')));

        shader.set_uniform_float(shader._uEnable5pStars,        1, [settings.get_boolean('mushroom-5pstars-enable')]);
        shader.set_uniform_float(shader._uRings,                1, [settings.get_int('mushroom-5pstarring-count')]);
        shader.set_uniform_float(shader._uRingRotation,         1, [settings.get_double('mushroom-5pstarring-rotation')]);
        shader.set_uniform_float(shader._uStarPerRing,          1, [settings.get_int('mushroom-5pstars-count')]);


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
    dialog.bindSwitch('mushroom-8bit-enable');

    dialog.bindColorButton('mushroom-star-color-0');
    dialog.bindColorButton('mushroom-star-color-1');
    dialog.bindColorButton('mushroom-star-color-2');
    dialog.bindColorButton('mushroom-star-color-3');
    dialog.bindColorButton('mushroom-star-color-4');
    dialog.bindColorButton('mushroom-star-color-5');
    // dialog.bindColorButton('star-color-6');
    dialog.bindSwitch('mushroom-4pstars-enable');
    dialog.bindAdjustment('mushroom-4pstars-count');
    dialog.bindColorButton('mushroom-4pstars-color');
    dialog.bindAdjustment('mushroom-4pstars-rotation');

    dialog.bindSwitch('mushroom-rays-enable');
    dialog.bindColorButton('mushroom-rays-color');

    dialog.bindSwitch('mushroom-5pstars-enable');
    dialog.bindAdjustment('mushroom-5pstarring-count');
    dialog.bindAdjustment('mushroom-5pstarring-rotation');
    dialog.bindAdjustment('mushroom-5pstars-count');


    // Connect the buttons only once. The bindPreferences can be called multiple times...
    if (!Effect._isConnected) {
      Effect._isConnected = true;

      // The star-gradient-reset button needs to be bound explicitly.
      dialog.getBuilder().get_object('reset-star-colors').connect('clicked', () => {
        dialog.getProfileSettings().reset('mushroom-star-color-0');
        dialog.getProfileSettings().reset('mushroom-star-color-1');
        dialog.getProfileSettings().reset('mushroom-star-color-2');
        dialog.getProfileSettings().reset('mushroom-star-color-3');
        dialog.getProfileSettings().reset('mushroom-star-color-4');
        dialog.getProfileSettings().reset('mushroom-star-color-5');
      });

      Effect._createMushroomPresets(dialog);

      // enables and disables prefs
      function updateSensitivity(dialog, state) {
        const ids = [
          'mushroom-4pstars-enable', 'mushroom-4pstars-count-scale',
          'mushroom-4pstars-color', 'mushroom-4pstars-rotation-scale',
          'mushroom-rays-enable', 'mushroom-rays-color', 'mushroom-5pstars-enable',
          'mushroom-5pstarring-count-scale', 'mushroom-5pstarring-enable',
          'mushroom-5pstarring-rotation-scale', 'mushroom-5pstars-count-scale',
          'mushroom-star-color-0', 'mushroom-star-color-1', 'mushroom-star-color-2',
          'mushroom-star-color-3', 'mushroom-star-color-4', 'mushroom-star-color-5',
          'mushroom-star-color-preset-button'
        ];

        ids.forEach(id => {
          const obj = dialog.getBuilder().get_object(id);

          if (obj && typeof obj.set_sensitive === 'function') {
            obj.set_sensitive(!state);  // Disable if state is ON, enable if OFF
          } else {
            log(`Warning: Object with ID '${
              id}' does not support set_sensitive or is null.`);
          }
        });
      }

      // Connect the state-set signal to 8BitSwitch
      const switchWidget = dialog.getBuilder().get_object('mushroom-8bit-enable');
      if (switchWidget) {
        switchWidget.connect('state-set', (widget, state) => {
          updateSensitivity(dialog,
                            state);  // Call the function when the signal is triggered
        });

        // Call the function manually on startup, based on the initial state of the switch
        const initialState =
          switchWidget.get_active();  // Get the initial state of the switch
        updateSensitivity(dialog, initialState);
      } else {
        log('Error: \'mushroom-8bit-enable\' switch widget not found.');
      }
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

  // This populates the preset dropdown menu for the fire options.
  static _createMushroomPresets(dialog) {
    dialog.getBuilder()
      .get_object('mushroom-star-color-preset-button')
      .connect('realize', (widget) => {
        const presets = [
          {
            name: _('Default Colors'),
            color0: 'rgba(233,249,0,1.0)',
            color1: 'rgba(233,249,0,1.0)',
            color2: 'rgba(91,255,0,1.0)',
            color3: 'rgba(91,255,0,1.0)',
            color4: 'rgba(0,240,236,1.0)',
            color5: 'rgba(0,240,236,1.0)',
          },
          {
            name: _('Red White and Blue'),
            color0: 'rgba(255, 0, 0, 1.0)',
            color1: 'rgba(255, 0, 0, 1.0)',
            color2: 'rgba(255,255,255, 1.0)',
            color3: 'rgba(255,255,255, 1.0)',
            color4: 'rgba(0,0,255, 1.0)',
            color5: 'rgba(0,0,255, 1.0)'
          },
          {
            name: _('Rainbow'),
            color0: 'rgba(255, 69, 58, 1.0)',   // Bold Red
            color1: 'rgba(255, 140, 0, 1.0)',   // Bold Orange
            color2: 'rgba(255, 223, 0, 1.0)',   // Bold Yellow
            color3: 'rgba(50, 205, 50, 1.0)',   // Bold Green
            color4: 'rgba(30, 144, 255, 1.0)',  // Bold Blue
            color5: 'rgba(148, 0, 211, 1.0)'    // Bold Purple
          },
          {
            name: _('Cattuccino Colors'),
            color0: 'rgba(239, 146, 160, 1.0)',
            color1: 'rgba(246, 178, 138, 1.0)',
            color2: 'rgba(240, 217, 169, 1.0)',
            color3: 'rgba(175, 223, 159, 1.0)',
            color4: 'rgba(149, 182, 246, 1.0)',
            color5: 'rgba(205, 170, 247, 1.0)'
          },
          {
            name: _('Dracula Colors'),
            color0: 'rgba(40, 42, 54, 1.0)',   // Red
            color1: 'rgba(68, 71, 90, 1.0)',   // Orange
            color2: 'rgba(90, 94, 119, 1.0)',  // Yellow
            color3: 'rgba(90, 94, 119, 1.0)',  // Green
            color4: 'rgba(68, 71, 90, 1.0)',   // Purple
            color5: 'rgba(40, 42, 54, 1.0)'    // Cyan
          }
        ];

        const menu      = Gio.Menu.new();
        const group     = Gio.SimpleActionGroup.new();
        const groupName = 'presets';

        // Add all presets.
        presets.forEach((preset, i) => {
          const actionName = 'mushroom' + i;
          menu.append(preset.name, groupName + '.' + actionName);
          let action = Gio.SimpleAction.new(actionName, null);

          // Load the preset on activation.
          action.connect('activate', () => {
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

          group.add_action(action);
        });

        dialog.getBuilder()
          .get_object('mushroom-star-color-preset-button')
          .set_menu_model(menu);

        const root = widget.get_root();
        root.insert_action_group(groupName, group);
      });
  }
}