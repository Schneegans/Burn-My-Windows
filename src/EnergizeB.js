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
// This effect looks a bit like the transporter effect from TNG.                        //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let Shader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var EnergizeB = class EnergizeB {

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. the '*-close-effect').
  static getNick() {
    return 'energize-b';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return 'Energize B';
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static initPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource(`/ui/${utils.getGTKString()}/EnergizeB.ui`);

    // Bind all properties.
    dialog.bindAdjustment('energize-b-animation-time');
    dialog.bindAdjustment('energize-b-scale');
    dialog.bindColorButton('energize-b-color');

    // Finally, append the settings page to the main stack.
    const stack = dialog.getBuilder().get_object('main-stack');
    stack.add_titled(
        dialog.getBuilder().get_object('energize-b-prefs'), EnergizeB.getNick(),
        EnergizeB.getLabel());
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is closed with this effect.
  static createShader(actor, settings) {
    return new Shader(settings);
  }

  // This is also called from extension.js. It is used to tweak the ongoing transitions of
  // the actor - usually windows are faded to transparency and scaled down slightly by
  // GNOME Shell. Here, we modify this behavior as well as the transition duration.
  static tweakTransitions(actor, settings) {
    const animationTime = settings.get_int('energize-b-animation-time');

    const tweakTransition = (property, value) => {
      const transition = actor.get_transition(property);
      if (transition) {
        transition.set_to(value);
        transition.set_duration(animationTime);
      }
    };

    // We re-target these transitions so that the window is neither scaled nor faded.
    tweakTransition('opacity', 255);
    tweakTransition('scale-x', 1);
    tweakTransition('scale-y', 1);
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

      const color = Clutter.Color.from_string(settings.get_string('energize-b-color'))[1];

      this.set_shader_source(`

      // Inject some common shader snippets.
      ${shaderSnippets.standardUniforms()}
      ${shaderSnippets.noise()}
      ${shaderSnippets.edgeMask()}

      const vec2  SEED         = vec2(${Math.random()}, ${Math.random()});
      const float SHOWER_TIME  = 0.2;
      const float SHOWER_WIDTH = 0.3;
      const float STREAK_TIME  = 0.6;
      const float EDGE_FADE    = 50;
      const float SCALE        = ${settings.get_double('energize-b-scale')};

      // This method returns four values:
      //  result.x: A mask for the particles which lead the shower.
      //  result.y: A mask for the streaks which follow the shower particles.
      //  result.z: A mask for the final "atom" particles.
      //  result.w: The opacity of the fading window.
      vec4 getMasks() {
        float showerProgress = uProgress/SHOWER_TIME;
        float streakProgress = clamp((uProgress-SHOWER_TIME)/STREAK_TIME, 0, 1);
        float fadeProgress  = clamp((uProgress-SHOWER_TIME)/(1.0 - SHOWER_TIME), 0, 1);

        // Gradient from top to bottom.
        float t = cogl_tex_coord_in[0].t;

        // A smooth gradient which moves to the bottom within the showerProgress.
        float showerMask = smoothstep(1, 0, abs(showerProgress - t - SHOWER_WIDTH) / SHOWER_WIDTH);

        // This is 1 above the streak mask.
        float streakMask = (showerProgress - t - SHOWER_WIDTH) > 0 ? 1 : 0;

        // Compute mask for the "atom" particles.
        float atomMask = getRelativeEdgeMask(0.2);
        atomMask = max(0, atomMask - showerMask);
        atomMask *= streakMask;
        atomMask *= (1.0 - fadeProgress);

        // Make some particles visible in the streaks.
        showerMask += 0.05 * streakMask;

        // Add shower mask to streak mask.
        streakMask = max(streakMask, showerMask);

        // Fade-out the masks at the window edges.
        float edgeFade = getAbsoluteEdgeMask(EDGE_FADE);
        streakMask *= edgeFade;
        showerMask *= edgeFade;
        
        // Fade-out the masks from top to bottom.
        float fade = smoothstep(0.0, 1.0, 1.0 + t - 2.0 * streakProgress);
        streakMask *= fade;
        showerMask *= fade;

        // Compute fading window opacity.
        float windowMask = pow(1.0 - fadeProgress, 2.0);

        return vec4(showerMask, streakMask, atomMask, windowMask);
      }

      void main() {
        
        vec4 masks       = getMasks();
        vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);
        vec3 effectColor = vec3(${color.red / 255},
                                ${color.green / 255},
                                ${color.blue / 255});

        // Dissolve window to effect color / transparency.
        cogl_color_out = mix(vec4(effectColor, 1.0) * windowColor.a, windowColor, 0.5 * masks.w + 0.5) * masks.w;

        // Add leading shower particles.
        vec2 showerUV = cogl_tex_coord_in[0].st + vec2(0, -0.7*uProgress/SHOWER_TIME);
        showerUV *= 0.02 * vec2(uSizeX, uSizeY) / SCALE;
        float shower = pow(simplex2D(showerUV), 10.0);
        cogl_color_out.rgb += effectColor * shower * masks.x;

        // Add trailing streak lines.
        vec2 streakUV = cogl_tex_coord_in[0].st + vec2(0, -uProgress/SHOWER_TIME);
        streakUV *= vec2(0.05 * uSizeX, 0.001 * uSizeY) / SCALE;
        float streaks = simplex2DFractal(streakUV) * 0.5;
        cogl_color_out.rgb += effectColor * streaks * masks.y;

        // Add glimmering atoms.
        vec2 atomUV = cogl_tex_coord_in[0].st + vec2(0, -0.025*uProgress/SHOWER_TIME);
        atomUV *= 0.2 * vec2(uSizeX, uSizeY) / SCALE;
        float atoms = pow((simplex3D(vec3(atomUV, uTime))), 5.0);
        cogl_color_out.rgb += effectColor * atoms * masks.z;

        // These are pretty useful for understanding how this works.
        // cogl_color_out = vec4(masks.rgb, 1.0);
        // cogl_color_out = vec4(vec3(masks.x), 1.0);
        // cogl_color_out = vec4(vec3(masks.y), 1.0);
        // cogl_color_out = vec4(vec3(masks.z), 1.0);
        // cogl_color_out = vec4(vec3(masks.w), 1.0);
        // cogl_color_out = vec4(vec3(shower), 1.0);
        // cogl_color_out = vec4(vec3(streaks), 1.0);
        // cogl_color_out = vec4(vec3(atoms), 1.0);
      }
      `);
    };
  });
}