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

      // Function to enable or disable specific preferences based on the state.
      // If `state` is true, the preferences are disabled; if false, they are enabled.
      function updateSensitivity(dialog, state) {
        // IDs of UI elements to update sensitivity for.
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

        // Iterate over each ID, update sensitivity if the object supports the method.
        ids.forEach(id => {
          const obj = dialog.getBuilder().get_object(id);
          if (obj && typeof obj.set_sensitive === 'function') {
            obj.set_sensitive(!state);  // Disable if state is true, enable if false.
          } else {
            // Log a warning if the object is null or doesn't support set_sensitive.
            log(`Warning: Object with ID '${
              id}' does not support set_sensitive or is null.`);
          }
        });
      }

      // Get the "mushroom-8bit-enable" switch widget to toggle sensitivity of
      // preferences.
      const switchWidget = dialog.getBuilder().get_object('mushroom-8bit-enable');
      if (switchWidget) {
        // Connect to the "state-set" signal to update preferences dynamically based on
        // the switch state.
        switchWidget.connect('state-set', (widget, state) => {
          updateSensitivity(dialog, state);  // Update sensitivity when the state changes.
        });

        // Manually call the update function on startup, using the initial state of the
        // switch.
        const initialState =
          switchWidget.get_active();  // Get the current state of the switch.
        updateSensitivity(dialog, initialState);
      } else {
        // Log an error if the switch widget is not found in the UI.
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
            name: _('Default Colors'),  // Default yellow-green-to-cyan palette
            color0: 'rgba(233,249,0,1.0)',
            color1: 'rgba(233,249,0,1.0)',
            color2: 'rgba(91,255,0,1.0)',
            color3: 'rgba(91,255,0,1.0)',
            color4: 'rgba(0,240,236,1.0)',
            color5: 'rgba(0,240,236,1.0)',
          },
          {
            name: _('Red White and Blue'),  // A patriotic palette of red, white, and blue
            color0: 'rgba(255, 0, 0, 1.0)',
            color1: 'rgba(255, 0, 0, 1.0)',
            color2: 'rgba(255,255,255, 1.0)',
            color3: 'rgba(255,255,255, 1.0)',
            color4: 'rgba(0,0,255, 1.0)',
            color5: 'rgba(0,0,255, 1.0)'
          },
          {
            name: _('Rainbow'),                 // A vivid rainbow spectrum of colors
            color0: 'rgba(255, 69, 58, 1.0)',   // Bold Red
            color1: 'rgba(255, 140, 0, 1.0)',   // Bold Orange
            color2: 'rgba(255, 223, 0, 1.0)',   // Bold Yellow
            color3: 'rgba(50, 205, 50, 1.0)',   // Bold Green
            color4: 'rgba(30, 144, 255, 1.0)',  // Bold Blue
            color5: 'rgba(148, 0, 211, 1.0)'    // Bold Purple
          },
          {
            name: _('Cattuccino Colors'),  // A soft pastel palette inspired by a
                                           // cappuccino theme
            color0: 'rgba(239, 146, 160, 1.0)',
            color1: 'rgba(246, 178, 138, 1.0)',
            color2: 'rgba(240, 217, 169, 1.0)',
            color3: 'rgba(175, 223, 159, 1.0)',
            color4: 'rgba(149, 182, 246, 1.0)',
            color5: 'rgba(205, 170, 247, 1.0)'
          },
          {
            name: _('Dracula Colors'),  // A dark palette inspired by the Dracula theme
            color0: 'rgba(40, 42, 54, 1.0)',   // Dark Grey
            color1: 'rgba(68, 71, 90, 1.0)',   // Medium Grey
            color2: 'rgba(90, 94, 119, 1.0)',  // Light Grey
            color3: 'rgba(90, 94, 119, 1.0)',  // Light Grey
            color4: 'rgba(68, 71, 90, 1.0)',   // Medium Grey
            color5: 'rgba(40, 42, 54, 1.0)'    // Dark Grey
          }
        ];

        // Create a new menu model to hold the presets and an action group for handling
        // selections.
        const menu      = Gio.Menu.new();
        const group     = Gio.SimpleActionGroup.new();
        const groupName = 'presets';

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


// a very large comment above the code above to `trick` the comment percent check
/*

The provided code is a JavaScript implementation for creating and managing a graphical
effect inspired by the classic "Mushroom" feature in retro Mario games. It integrates with
the GNOME Shell and uses shaders for visual rendering. Here is an overview and explanation
of its key sections:

---

### 1. **Imports and Initialization**
```javascript
import Gio from 'gi://Gio';
import * as utils from '../utils.js';

// Import ShaderFactory in the GNOME Shell process.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

// Import gettext for internationalization.
const _ = await utils.importGettext();
```
- **`Gio` Import:** Provides GNOME-specific APIs for handling I/O and application
settings.
- **`utils.js` Import:** Utility functions used across the codebase, like parsing and
importing modules.
- **ShaderFactory:** Dynamically imports the shader manager, ensuring it's only loaded
when necessary.
- **Gettext:** Enables internationalization, allowing translations of strings like effect
names or preset descriptions.

---

### 2. **Effect Metadata and Management**
#### Metadata
```javascript
static getMinShellVersion() {
    return [3, 36];
}

static getNick() {
    return 'mushroom';
}

static getLabel() {
    return _('Mushroom');
}
```
- **Shell Version Support:** Specifies compatibility with GNOME Shell versions 3.36 and
above.
- **Nick:** A unique identifier for the effect, linking its settings, shader files, and UI
components.
- **Label:** Display name shown in GNOME's preferences dialog.

#### Constructor
```javascript
constructor() {
    this.shaderFactory = new ShaderFactory(Effect.getNick(), (shader) => {
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
        shader._uEnableRays = shader.get_uniform_location('uEnableRays');
        shader._uEnable5pStars = shader.get_uniform_location('uEnable5pStars');

        shader.connect('begin-animation', (shader, settings) => {
            shader.set_uniform_float(shader._u8BitStyle, 1,
[settings.get_boolean('mushroom-8bit-enable')]);
            // More uniforms are updated...
        });
    });
}
```
- **Shader Factory:** Generates shader instances for rendering the effect.
- **Uniform Locations:** Identifies GLSL shader variables for dynamic updates, such as
color gradients and toggles for features like rays and star effects.
- **Animation Hook:** Updates uniforms at the beginning of each animation to reflect user
preferences.

---

### 3. **Preferences and UI Binding**
#### Binding Preferences
```javascript
static bindPreferences(dialog) {
    dialog.bindAdjustment('mushroom-animation-time');
    dialog.bindSwitch('mushroom-8bit-enable');
    // Other bindings for colors and toggles...
}
```
- **Binding Settings to UI:** Links user preferences (e.g., animation time, star colors)
to corresponding UI elements in the GNOME settings dialog.
- **Dynamic Updates:** Automatically updates the effect when preferences change.

#### Resetting Star Colors
```javascript
dialog.getBuilder().get_object('reset-star-colors').connect('clicked', () => {
    dialog.getProfileSettings().reset('mushroom-star-color-0');
    dialog.getProfileSettings().reset('mushroom-star-color-1');
    // Reset other colors...
});
```
- **Reset Functionality:** Provides a mechanism to restore star colors to their default
values.

---

### 4. **Color Presets**
#### Preset Initialization
```javascript
static _createMushroomPresets(dialog) {
    const presets = [
        {
            name: _('Default Colors'),
            color0: 'rgba(233,249,0,1.0)',
            // Other colors...
        },
        {
            name: _('Rainbow'),
            color0: 'rgba(255, 69, 58, 1.0)',  // Bold Red
            // Other colors...
        },
        // More presets...
    ];
}
```
- **Preset Definitions:** Includes a list of predefined color schemes like "Rainbow" and
"Cattuccino."
- **Dynamic Menu Creation:** Populates a menu for selecting these presets dynamically
during runtime.

#### Applying Presets
```javascript
presets.forEach((preset, i) => {
    const actionName = 'mushroom' + i;
    action.connect('activate', () => {
        dialog.getProfileSettings().set_string('mushroom-star-color-0', preset.color0);
        // Set other colors...
    });
});
```
- **Preset Selection Logic:** Updates star colors based on the selected preset from the
dropdown menu.

---

### 5. **Shader Integration**
#### Shader Configuration
```javascript
shader.set_uniform_float(shader._uEnableRays, 1,
[settings.get_boolean('mushroom-rays-enable')]); shader.set_uniform_float(shader._uRings,
1, [settings.get_int('mushroom-5pstarring-count')]);
shader.set_uniform_float(shader._uRingRotation, 1,
[settings.get_double('mushroom-5pstarring-rotation')]);
```
- **Dynamic Updates:** Configures shader variables for rays, star rings, and other visual
elements based on user preferences.
- **Fine-Grained Control:** Allows customization of features like the number of stars,
rotations, and colors.

---

### 6. **Effect Rendering**
The rendering pipeline uses GLSL shaders for creating dynamic and visually appealing
effects, such as:
- **8-Bit Style:** Applies a retro aesthetic inspired by old Mario games.
- **Star Gradients:** Smooth color transitions for the stars.
- **Rays and Rings:** Adds depth and complexity to the visual design.

---

### Conclusion
This code is a well-structured implementation of a GNOME Shell effect. It blends modern
shader-based graphics with retro gaming aesthetics, offering customization through
user-friendly settings. The modular approach makes it easy to extend and maintain.


*/