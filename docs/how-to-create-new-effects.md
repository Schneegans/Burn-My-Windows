# 🔥 Creating a new Effect for Burn-My-Windows

The extension is very modular and with a bit of creativity and GLSL knowledge, you can easily create your own effects.
If you are happy with your results, please open a pull request so that we can include your effect in the next version of Burn-My-Windows!

### Before you Start

First you should [fork the repository](https://github.com/Schneegans/Burn-My-Windows/fork) and clone it to your PC.
Afterwards, use a terminal in the directory of the cloned repository to install the extension.

```bash
make install
```

_:information_source: Whenever you changed something in the source code, you will have to call this command and restart GNOME Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd>.
Or logout / login if you are on Wayland to see the changes._

### Debugging

Debugging GNOME Shell extensions is a bit difficult.
Most of the time, you will print messages to a log in order to understand what is going on.
To make this a bit more convenient, Burn-My-Windows includes the method `utils.debug("Hello World")`.
With this, each line will be prefixed with the extension's name, which will make spotting log messages more easy. You can use the following command to watch the log output; it will highlight all messages from Burn-My-Windows:

```bash
journalctl -f -o cat | grep -E 'burn-my-windows|'
```

## Adding a new Effect

For the sake of this tutorial, we will create a **"Simple Fade"** effect.
Of course, you can replace any occurrence of this name and its nick `simple-fade` with your custom effect name.

Three simple steps are required to create a new effect. 
You will have to ...

1. add a preferences key for enabling the effect,
2. create an additional effects class, and finally
3. register the new effect in two places.

### 1. Expanding the Schema

For enabling the new effect, the boolean settings key `simple-fade-close-effect` is required.
In this example, we also add an integer valued settings key for storing the animation time of the new effect and a floating point value for storing another property of the effect - we will use them later in the tutorial.
Just copy the XML code below to the file [`schemas/org.gnome.shell.extensions.burn-my-windows.gschema.xml`](../schemas/org.gnome.shell.extensions.burn-my-windows.gschema.xml).
Just remember to replace `simple-fade` with your custom name!

```xml
<!-- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -->
<!-- Simple Fade Effect Options                                                    -->
<!-- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -->

<key name="simple-fade-close-effect" type="b">
  <default>false</default>
  <summary>Simple Fade Close Effect</summary>
  <description>Use the Simple Fade effect for window closing.</description>
</key>

<key name="simple-fade-animation-time" type="i">
  <default>1500</default>
  <summary>Simple Fade Animation Time</summary>
  <description>The time the Simple Fade effect takes.</description>
</key>

<key name="simple-fade-width" type="d">
  <default>0.1</default>
  <summary>Simple Fade Width</summary>
  <description>Width of the fading effect.</description>
</key>
```

### 2. Creating the Effect Class

You will have to create a new file called `src/SimpleFade.js` and paste the following code to it.
Please study this code carefully, all of it is explained with inline comments.

<details>
  <summary>Expand this to show the code.</summary>

```javascript
//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//                       Copyright (c) 2021 Simon Schneegans                            //
//          Released under the GPLv3 or later. See LICENSE file for details.            //
//////////////////////////////////////////////////////////////////////////////////////////

'use strict';

const GObject = imports.gi.GObject;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This effect ...                                                                      //
// <- Please add a description of your effect here ->                                   //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let Shader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var SimpleFade = class SimpleFade {

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-close-effect'), and its animation time
  // (e.g. '*-animation-time').
  static getNick() {
    return 'simple-fade';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return 'Simple Fade Effect';
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static getPreferences(dialog) {
    // Empty for now... Code is added here later in the tutorial!
    return null;
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is closed with this effect.
  static createShader(actor, settings) {
    return new Shader(settings);
  }

  // The tweakTransition() is called from extension.js to tweak a window's open / close
  // transitions - usually windows are faded in / out and scaled up / down by GNOME Shell.
  // The parameter 'forOpening' is set to true if this is called for a window-open
  // transition, for a window-close transition it is set to false. The modes can be set to
  // any value from here: https://gjs-docs.gnome.org/clutter8~8_api/clutter.animationmode.
  // The only required property is 'opacity', even if it transitions from 1.0 to 1.0. The
  // current value of the opacity transition is passed as uProgress to the shader.
  // Tweaking the actor's scale during the transition only works properly for GNOME 3.38+.

  // For this effect, windows should neither be scaled nor faded.
  static tweakTransition(actor, settings, forOpening) {
    return {
      'opacity': {from: 255, to: 255, mode: 4},
      'scale-x': {from: 1.0, to: 1.0, mode: 4},
      'scale-y': {from: 1.0, to: 1.0, mode: 4}
    };
  }
}


//////////////////////////////////////////////////////////////////////////////////////////
// The shader class for this effect will only be registered in GNOME Shell's process    //
// (not in the preferences process). It's done this way as Clutter may not be installed //
// on the system and therefore the preferences would crash.                             //
//////////////////////////////////////////////////////////////////////////////////////////

if (utils.isInShellProcess()) {

  const Clutter        = imports.gi.Clutter;
  const shaderSnippets = Me.imports.src.shaderSnippets;

  Shader = GObject.registerClass({}, class Shader extends Clutter.ShaderEffect {
    _init(settings) {
      super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

      this.set_shader_source(`

        // The code below injects some standard uniforms which will be updated during the
        // animation. This includes:
        // uTexture:    Contains the texture of the window.
        // uProgress:   A value which transitions from 0 to 1 during the entire animation.
        // uTime:       A steadily increasing value in seconds.
        // uSizeX:      The horizontal size of uTexture in pixels.
        // uSizeY:      The vertical size of uTexture in pixels.
        ${shaderSnippets.standardUniforms()}

        // The width of the fading effect is directly loaded from the settings.
        const float FADE_WIDTH = ${settings.get_double('simple-fade-width')};

        void main() {

          // Get the color from the window texture.
          vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);

          // Radial distance from window edge to the window's center.
          float dist = length(cogl_tex_coord_in[0].st - 0.5) * 2.0 / sqrt(2.0);

          // This gradually dissolves from [1..0] from the outside to the center.
          float mask = (1.0 - uProgress * (1.0 + FADE_WIDTH) - dist + FADE_WIDTH) / FADE_WIDTH;

          // Make the mask smoother.
          mask = smoothstep(0, 1, mask);

          // Set the final output color. This uses premultiplied alpha.
          cogl_color_out = windowColor * mask;
        }
      `);
    };
  });
}
```

</details>

### 3. Registering the new Effect

You will have to register the new effect in two files.
Both, [`extension.js`](../extension.js) and [`prefs.js`](../prefs.js) define an array in the beginning where you have to add an import to your new effect.
Like this:

```javascript
const ALL_EFFECTS = [
  ...
  Me.imports.src.SimpleFade.SimpleFade,
  ...
];
```



### Testing your Effect

Now you can call `make install` and restart GNOME Shell with <kbd>Alt</kbd> + <kbd>F2</kbd>, <kbd>r</kbd> + <kbd>Enter</kbd>.
Or logout / login if you are on Wayland.
You can open the extension's preferences and choose the new effect!
However, there are no configuration options yet.
It is also not possible to adjust the animation time setting.

```bash
gnome-extensions prefs burn-my-windows@schneegans.github.com
```

## Adding a Preferences Page

There should be two sliders in this example: The animation duration and the width of the fading gradient.

If your effect supports GNOME Shell 3.3x _and_ GNOME Shell 40+, you will have to provide two `*.ui` files for this.
This is because starting with GNOME Shell 40, the preference dialog uses GTK4, before it used to use GTK3.
Usually, there are only a few minor differences between the two files.
We will load the respective file in the `getPreferences()` method of your new effect class.

Just save the code below to `resources/ui/gtk3/SimpleFade.ui` and `resources/ui/gtk4/SimpleFade.ui` respectively.
Remember to replace any occurrence of `simple-fade` with your effect's nick-name!

<details>
  <summary>Expand this to show the GTK3 code.</summary>

```xml
<?xml version="1.0" encoding="UTF-8"?>
<interface>

  <object class="GtkAdjustment" id="simple-fade-animation-time">
    <property name="upper">5000</property>
    <property name="lower">100</property>
    <property name="step-increment">10</property>
    <property name="page-increment">100</property>
  </object>

  <object class="GtkAdjustment" id="simple-fade-width">
    <property name="upper">1</property>
    <property name="lower">0</property>
    <property name="step-increment">0.01</property>
    <property name="page-increment">0.1</property>
  </object>

  <object class="GtkBox" id="simple-fade-prefs">
    <property name="orientation">vertical</property>

    <child>
      <object class="GtkFrame">
        <child>
          <object class="GtkListBox">
            <property name="selection-mode">none</property>
            <style>
              <class name="rich-list" />
            </style>

            <child>
              <object class="GtkListBoxRow">
                <property name="margin-start">10</property>
                <property name="margin-end">10</property>
                <property name="margin-top">10</property>
                <property name="margin-bottom">10</property>
                <property name="activatable">0</property>
                <child>
                  <object class="GtkBox">
                    <child>
                      <object class="GtkLabel">
                        <property name="label" translatable="yes">Animation Time [ms]</property>
                        <property name="xalign">0</property>
                        <property name="halign">start</property>
                        <property name="valign">center</property>
                        <property name="hexpand">1</property>
                      </object>
                    </child>
                    <child>
                      <object class="GtkScale">
                        <property name="halign">end</property>
                        <property name="valign">center</property>
                        <property name="draw-value">1</property>
                        <property name="digits">0</property>
                        <property name="value-pos">left</property>
                        <property name="width-request">300</property>
                        <property name="adjustment">simple-fade-animation-time</property>
                      </object>
                    </child>
                    <child>
                      <object class="GtkButton" id="reset-simple-fade-animation-time">
                        <child>
                          <object class="GtkImage">
                            <property name="icon-name">edit-clear-symbolic</property>
                            <property name="icon-size">1</property>
                          </object>
                        </child>
                        <property name="tooltip-text" translatable="yes">Reset to Default Value</property>
                        <style>
                          <class name="flat" />
                        </style>
                      </object>
                    </child>
                  </object>
                </child>
              </object>
            </child>

            <child>
              <object class="GtkListBoxRow">
                <property name="margin-start">10</property>
                <property name="margin-end">10</property>
                <property name="margin-top">10</property>
                <property name="margin-bottom">10</property>
                <property name="activatable">0</property>
                <child>
                  <object class="GtkBox">
                    <child>
                      <object class="GtkLabel">
                        <property name="label" translatable="yes">Fade Width</property>
                        <property name="xalign">0</property>
                        <property name="halign">start</property>
                        <property name="valign">center</property>
                        <property name="hexpand">1</property>
                      </object>
                    </child>
                    <child>
                      <object class="GtkScale">
                        <property name="halign">end</property>
                        <property name="valign">center</property>
                        <property name="draw-value">1</property>
                        <property name="digits">2</property>
                        <property name="value-pos">left</property>
                        <property name="width-request">300</property>
                        <property name="adjustment">simple-fade-width</property>
                      </object>
                    </child>
                    <child>
                      <object class="GtkButton" id="reset-simple-fade-width">
                        <child>
                          <object class="GtkImage">
                            <property name="icon-name">edit-clear-symbolic</property>
                            <property name="icon-size">1</property>
                          </object>
                        </child>
                        <property name="tooltip-text" translatable="yes">Reset to Default Value</property>
                        <style>
                          <class name="flat" />
                        </style>
                      </object>
                    </child>
                  </object>
                </child>
              </object>
            </child>

          </object>
        </child>
      </object>
    </child>

  </object>

</interface>
```

</details>

<details>
  <summary>Expand this to show the GTK4 code.</summary>

```xml
<?xml version="1.0" encoding="UTF-8"?>
<interface>

  <object class="GtkAdjustment" id="simple-fade-animation-time">
    <property name="upper">5000</property>
    <property name="lower">100</property>
    <property name="step-increment">10</property>
    <property name="page-increment">100</property>
  </object>

  <object class="GtkAdjustment" id="simple-fade-width">
    <property name="upper">1</property>
    <property name="lower">0</property>
    <property name="step-increment">0.01</property>
    <property name="page-increment">0.1</property>
  </object>

  <object class="GtkBox" id="simple-fade-prefs">
    <property name="orientation">vertical</property>

    <child>
      <object class="GtkFrame">
        <child>
          <object class="GtkListBox">
            <property name="selection-mode">none</property>
            <property name="show-separators">1</property>
            <style>
              <class name="rich-list" />
            </style>

            <child>
              <object class="GtkListBoxRow">
                <property name="activatable">0</property>
                <child>
                  <object class="GtkBox">
                    <child>
                      <object class="GtkLabel">
                        <property name="label" translatable="yes">Animation Time [ms]</property>
                        <property name="xalign">0</property>
                        <property name="halign">start</property>
                        <property name="valign">center</property>
                        <property name="hexpand">1</property>
                      </object>
                    </child>
                    <child>
                      <object class="GtkScale">
                        <property name="halign">end</property>
                        <property name="valign">center</property>
                        <property name="draw-value">1</property>
                        <property name="digits">0</property>
                        <property name="value-pos">left</property>
                        <property name="width-request">300</property>
                        <property name="adjustment">simple-fade-animation-time</property>
                      </object>
                    </child>
                    <child>
                      <object class="GtkButton" id="reset-simple-fade-animation-time">
                        <property name="icon-name">edit-clear-symbolic</property>
                        <property name="tooltip-text" translatable="yes">Reset to Default Value</property>
                        <style>
                          <class name="flat" />
                        </style>
                      </object>
                    </child>
                  </object>
                </child>
              </object>
            </child>

            <child>
              <object class="GtkListBoxRow">
                <property name="activatable">0</property>
                <child>
                  <object class="GtkBox">
                    <child>
                      <object class="GtkLabel">
                        <property name="label" translatable="yes">Fade Width</property>
                        <property name="xalign">0</property>
                        <property name="halign">start</property>
                        <property name="valign">center</property>
                        <property name="hexpand">1</property>
                      </object>
                    </child>
                    <child>
                      <object class="GtkScale">
                        <property name="halign">end</property>
                        <property name="valign">center</property>
                        <property name="draw-value">1</property>
                        <property name="digits">2</property>
                        <property name="value-pos">left</property>
                        <property name="width-request">300</property>
                        <property name="adjustment">simple-fade-width</property>
                      </object>
                    </child>
                    <child>
                      <object class="GtkButton" id="reset-simple-fade-width">
                        <property name="icon-name">edit-clear-symbolic</property>
                        <property name="tooltip-text" translatable="yes">Reset to Default Value</property>
                        <style>
                          <class name="flat" />
                        </style>
                      </object>
                    </child>
                  </object>
                </child>
              </object>
            </child>

          </object>
        </child>
      </object>
    </child>

  </object>

</interface>
```

</details>

### Loading the Preferences Page

In order to load the above `*.ui` files, add the following code to your effect's `getPreferences()` method.

```javascript
static getPreferences(dialog) {

  // Add the settings page to the builder.
  dialog.getBuilder().add_from_resource(`/ui/${utils.getGTKString()}/SimpleFade.ui`);

  // These connect the settings to the UI elements. Have a look at prefs.js
  // on how to bind other types of UI elements.
  dialog.bindAdjustment('simple-fade-animation-time');
  dialog.bindAdjustment('simple-fade-width');

  // Finally, return the new settings page.
  return dialog.getBuilder().get_object('simple-fade-prefs');
}
```

Once this is in place, you can kill the extension-preferences process and re-open the settings.
It is not required to reload GNOME Shell for developing the preferences dialog!
Here's a handy one-liner to do this:

```bash
make install && pkill -f '.Extensions' && sleep 2 ; gnome-extensions prefs burn-my-windows@schneegans.github.com
```

## Summing Up

That's it!
If you have any questions, feel free to [ask them on the discussions board](https://github.com/Schneegans/Burn-My-Windows/discussions).
If you are happy with your effect, submit a pull request, and it may get included in the next version!