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
// The TVShader hides the actor by making it first transparent from top and             //
// bottom towards the middle and then hiding the resulting line from left and right     //
// towards the center.                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let TVShader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var TVEffect = class TVEffect {

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. the '*-close-effect').
  static getNick() {
    return 'tv';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return 'TV Effect';
  }

  // -------------------------------------------------------------------- API for prefs.js


  static initPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource(
        `/ui/${utils.isGTK4() ? 'gtk4' : 'gtk3'}/tvPage.ui`);

    // Bind all properties.
    dialog.bindAdjustment('tv-animation-time');
    dialog.bindColorButton('tv-effect-color');

    // Finally, append the settings page to the main stack.
    const stack = dialog.getBuilder().get_object('main-stack');
    stack.add_titled(
        dialog.getBuilder().get_object('tv-prefs'), TVEffect.getNick(),
        TVEffect.getLabel());
  }

  // ---------------------------------------------------------------- API for extension.js


  static createShader(settings) {
    return new TVShader(settings);
  }

  // If there's a transition in progress, we re-target these transitions so that the
  // window is neither scaled nor faded.
  static tweakTransitions(actor, settings) {
    const animationTime = settings.get_int('tv-animation-time');

    const tweakTransition = (property, value) => {
      const transition = actor.get_transition(property);
      if (transition) {
        transition.set_to(value);
        transition.set_duration(animationTime);
      }
    };

    tweakTransition('opacity', 255);
    tweakTransition('scale-x', 1);
    tweakTransition('scale-y', 0.5);
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

  TVShader = GObject.registerClass({Properties: {}, Signals: {}},
                                   class TVShader extends Clutter.ShaderEffect {
    _init(settings) {
      super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

      const color = Clutter.Color.from_string(settings.get_string('tv-effect-color'))[1];

      this.set_shader_source(`

      // Inject some common shader snippets.
      ${shaderSnippets.standardUniforms()}

      const float BLUR_WIDTH = 0.01; // Width of the gradients.
      const float TB_TIME    = 0.7;  // Relative time for the top/bottom animation.
      const float LR_TIME    = 0.4;  // Relative time for the left/right animation.
      const float LR_DELAY   = 0.6;  // Delay after which the left/right animation starts.
      const float FF_TIME    = 0.2;  // Relative time for the final fade to transparency.

      void main() {

        // All of these are in [0..1] during the different stages of the animation.
        // tb refers to the top-bottom animation.
        // lr refers to the left-right animation.
        // ff refers to the final fade animation.
        float tbProgress = smoothstep(0, 1, clamp(uProgress/TB_TIME, 0, 1));
        float lrProgress = smoothstep(0, 1, clamp((uProgress - LR_DELAY)/LR_TIME, 0, 1));
        float ffProgress = smoothstep(0, 1, clamp((uProgress - 1.0 + FF_TIME)/FF_TIME, 0, 1));

        // This is a top-center-bottom gradient in [0..1..0]
        float tb = cogl_tex_coord_in[0].t * 2;
        tb = tb < 1 ? tb : 2 - tb;
        
        // This is a left-center-right gradient in [0..1..0]
        float lr = cogl_tex_coord_in[0].s * 2;
        lr = lr < 1 ? lr : 2 - lr;
        
        // Combine the progress values with the gradients to create the alpha masks.
        float tbMask = 1 - smoothstep(0, 1, clamp((tbProgress - tb) / BLUR_WIDTH, 0, 1));
        float lrMask = 1 - smoothstep(0, 1, clamp((lrProgress - lr) / BLUR_WIDTH, 0, 1));
        float ffMask = 1 - smoothstep(0, 1, ffProgress);

        // Assemble the final alpha value.
        float mask = tbMask * lrMask * ffMask;

        vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);
        vec4 effectColor = vec4(${color.red / 255},
                                ${color.green / 255},
                                ${color.blue / 255}, 1.0) * windowColor.a;

        windowColor.rgb = mix(windowColor.rgb, effectColor.rgb, smoothstep(0, 1, uProgress));

        cogl_color_out = windowColor * mask;

        // These are pretty useful for understanding how this works.
        // cogl_color_out = vec4(vec3(tbMask), 1);
        // cogl_color_out = vec4(vec3(lrMask), 1);
        // cogl_color_out = vec4(vec3(ffMask), 1);
        // cogl_color_out = vec4(vec3(mask), 1);
      }
      `);
    };
  });
}