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
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let Shader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var TOSTransporterEffect = class TOSTransporterEffect {

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. the '*-close-effect').
  static getNick() {
    return 'tos-transporter';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return 'TOS Transporter Effect';
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static initPreferences(dialog) {

    // Add the settings page to the builder.
    // dialog.getBuilder().add_from_resource(`/ui/${utils.getGTKString()}/tvPage.ui`);

    // Bind all properties.
    // dialog.bindAdjustment('tv-animation-time');
    // dialog.bindColorButton('tv-effect-color');

    // Finally, append the settings page to the main stack.
    // const stack = dialog.getBuilder().get_object('main-stack');
    // stack.add_titled(
    //     dialog.getBuilder().get_object('tv-prefs'), TOSTransporterEffect.getNick(),
    //     TOSTransporterEffect.getLabel());
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is closed with this effect.
  static createShader(settings) {
    return new Shader(settings);
  }

  // This is also called from extension.js. It is used to tweak the ongoing transitions of
  // the actor - usually windows are faded to transparency and scaled down slightly by
  // GNOME Shell. Here, we modify this behavior as well as the transition duration.
  static tweakTransitions(actor, settings) {
    const animationTime = settings.get_int('tos-transporter-animation-time');

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

      const color =
          Clutter.Color.from_string(settings.get_string('tos-transporter-color'))[1];

      this.set_shader_source(`

      // Inject some common shader snippets.
      ${shaderSnippets.standardUniforms()}
      ${shaderSnippets.noise()}

      const vec2  SEED          = vec2(${Math.random()}, ${Math.random()});
      const float SPARK_RADIUS  = 30.0;
      const float SPARK_SPEED   = 10.0;
      const float SPARK_SPACING = 50 + SPARK_RADIUS;
      const int   SPARK_LAYERS  = 15;

      float getSparks(vec2 texCoords, float gridSize, vec2 seed) {

        // Shift coordinates by a random offset and make sure the have a 1:1 aspect ratio.
        vec2 coords = (texCoords + hash2D(seed)) * vec2(uSizeX, uSizeY);

        // Apply global scale.
        coords /= gridSize;

        // Get grid cell coordinates in [0..1].
        vec2 cellUV = mod(coords, vec2(1));

        // This is unique for each cell.
        vec2 cellID = coords-cellUV + vec2(362.456);

        // Add random rotation, scale and offset to each grid cell.
        float speed     = mix(10.0, 15.0,   hash(cellID*seed*134.451)) / gridSize * SPARK_SPEED;
        float rotation  = mix( 0.0,  6.283, hash(cellID*seed*54.4129));
        float radius    = mix( 0.5,  1.0,   hash(cellID*seed*19.1249)) * SPARK_RADIUS;
        float roundness = mix(-1.0,  1.0,   hash(cellID*seed*7.51949));

        vec2 offset = vec2(sin(speed * (uTime+10)) * roundness, cos(speed * (uTime+10)));
        offset *= (0.5 - radius / gridSize);

        offset = vec2(offset.x * cos(rotation) - offset.y * sin(rotation),
                      offset.x * sin(rotation) + offset.y * cos(rotation));

        cellUV += offset;

        float dist = length(cellUV - 0.5) * gridSize / radius;
          
        if (dist < 1.0) {
          return exp(-4.0 * dist);
          // return 0.03 / pow(dist, 2.0);
        }

        return 0;
      }

      void main() {

        vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);
        vec4 effectColor = vec4(${color.red / 255},
                                ${color.green / 255},
                                ${color.blue / 255}, 1.0) * windowColor.a;

        vec2 uv = cogl_tex_coord_in[0].st * vec2(uSizeX, uSizeY) / 20 + vec2(0, uTime);
        float sparks = 0;
        
        for (int i=0; i<SPARK_LAYERS; ++i) {
          sparks += getSparks((cogl_tex_coord_in[0].st-0.5) / mix(2.0, 1.0, uProgress), SPARK_SPACING, SEED * (i+1));
        }

        float noise = noise3D(vec3(uv, uTime*5.0), 5);
        sparks = sparks*(noise*0.8 + 0.2) + noise*0.15;

        float edgeFadeWidth = 0.5;
        float heartMask     = 1.0;
        float heart         = 0.0;
        heartMask *= smoothstep(0, 1, clamp(cogl_tex_coord_in[0].x / edgeFadeWidth, 0, 1));
        heartMask *= smoothstep(0, 1, clamp(cogl_tex_coord_in[0].y / edgeFadeWidth, 0, 1));
        heartMask *= smoothstep(0, 1, clamp((1.0 - cogl_tex_coord_in[0].x) / edgeFadeWidth, 0, 1));
        heartMask *= smoothstep(0, 1, clamp((1.0 - cogl_tex_coord_in[0].y) / edgeFadeWidth, 0, 1));

        heartMask = pow(heartMask, 10.0);

        for (int i=0; i<SPARK_LAYERS; ++i) {
          heart += heartMask * getSparks((cogl_tex_coord_in[0].st-0.5) / mix(2.0, 1.0, uProgress), SPARK_SPACING, SEED * (i+1+SPARK_LAYERS));
        }

        heart *= (noise*0.8 + 0.2);
        
        const float FADE_IN_TIME  = 0.3;
        const float FADE_OUT_TIME = 0.4;

        float fadeIn   = smoothstep(0, 1, clamp(uProgress/FADE_IN_TIME, 0, 1));
        float fadeOut  = smoothstep(0, 1, clamp((uProgress - FADE_IN_TIME)/FADE_OUT_TIME, 0, 1));
        float heartOut = smoothstep(0, 1, clamp((uProgress - FADE_IN_TIME)/(1.0 - FADE_IN_TIME), 0, 1));

        cogl_color_out = windowColor * clamp(1-fadeOut, 0, 1);
        cogl_color_out += min(fadeIn, 1-fadeOut) * sparks * effectColor;
        cogl_color_out += min(fadeIn, 1-heartOut) * heart * effectColor;

        // These are pretty useful for understanding how this works.
        // cogl_color_out = vec4(vec3(heartMask), 1.0);
      }
      `);
    };
  });
}