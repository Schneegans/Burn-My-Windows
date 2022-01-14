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

const Clutter = utils.isInShellProcess() ? imports.gi.Clutter : null;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let Shader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var TNGTransporterEffect = class TNGTransporterEffect {

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. the '*-close-effect').
  static getNick() {
    return 'tng-transporter';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return 'TNG Transporter Effect';
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
    //     dialog.getBuilder().get_object('tv-prefs'), TNGTransporterEffect.getNick(),
    //     TNGTransporterEffect.getLabel());
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
    const animationTime = settings.get_int('tng-transporter-animation-time');

    const tweakTransition = (property, value) => {
      const transition = actor.get_transition(property);
      if (transition) {
        transition.set_to(value);
        transition.set_duration(animationTime);
        transition.set_progress_mode(Clutter.AnimationMode.LINEAR);
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

  const shaderSnippets = Me.imports.src.shaderSnippets;

  Shader = GObject.registerClass({}, class Shader extends Clutter.ShaderEffect {
    _init(settings) {
      super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

      const color =
          Clutter.Color.from_string(settings.get_string('tng-transporter-color'))[1];

      this.set_shader_source(`

      // Inject some common shader snippets.
      ${shaderSnippets.standardUniforms()}
      ${shaderSnippets.noise()}

      const vec2  SEED          = vec2(${Math.random()}, ${Math.random()});
      const float SPARK_RADIUS  = 15.0;
      const float SPARK_SPEED   = 20.0;
      const float SPARK_SPACING = 50 + SPARK_RADIUS;
      const int   SPARK_LAYERS  = 15;

      const float SHOWER_TIME = 0.2;

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
          return 5.0 * exp(-10.0 * dist);
          return 0.05 / pow(dist, 2.0);
        }

        return 0;
      }

      // This method requires the uniforms from standardUniforms() to be available.
      // It returns two values: The first is used as a mask for the particles which lead
      // the shower. The second is used as a mask for the streaks which follow the particles. 
      // showerTime:    A value in [0..1]. It determines the percentage of the animation which
      //                is spent for the shower to come down. 1-showerTime will be spent
      //                thereafter for dissolving the streak mask.
      // showerWidth:   The relative size of the particle gradient in [0..1].
      // edgeFadeWidth: The pixel width of the effect fading range at the edges of the window.
      vec3 getMasks(float showerTime, float showerWidth, float edgeFadeWidth) {
        float showerProgress      = uProgress/showerTime;
        float afterShowerProgress = clamp((uProgress-showerTime)/(1-showerTime), 0, 1);

        // Gradient from top to bottom.
        float t = cogl_tex_coord_in[0].t;

        // A smooth gradient which moves to the bottom within the showerProgress.
        float showerMask = smoothstep(1, 0, abs(showerProgress - t - showerWidth) / showerWidth);

        // This is one above the streak mask.
        float streakMask = (showerProgress - t - showerWidth) > 0 ? 1 : 0;

        showerMask += 0.05 * streakMask;

        // Add shower mask to streak mask.
        streakMask = max(streakMask, showerMask);

        // Fade-out when the masks.
        if (uProgress > showerTime) {
          float fade = mix(1, t * (1.0-afterShowerProgress), afterShowerProgress);
          streakMask *= fade;
          showerMask *= fade;
        }

        // Fade at window borders.
        vec2 pos = cogl_tex_coord_in[0].st * vec2(uSizeX, uSizeY);
        float edgeFade = 1.0;
        edgeFade *= smoothstep(0, 1, clamp(pos.x / edgeFadeWidth, 0, 1));
        edgeFade *= smoothstep(0, 1, clamp(pos.y / edgeFadeWidth, 0, 1));
        edgeFade *= smoothstep(0, 1, clamp((uSizeX - pos.x) / edgeFadeWidth, 0, 1));
        edgeFade *= smoothstep(0, 1, clamp((uSizeY - pos.y) / edgeFadeWidth, 0, 1));

        float windowMask = pow(1.0 - afterShowerProgress, 2.0);

        return vec3(showerMask * edgeFade, streakMask * edgeFade, windowMask);
      }

      void main() {
        
        vec3 masks       = getMasks(SHOWER_TIME, 0.2, 50);
        vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);
        vec3 effectColor = vec3(${color.red / 255},
                                ${color.green / 255},
                                ${color.blue / 255});

        cogl_color_out = windowColor * masks.z;

        vec2 uv = cogl_tex_coord_in[0].st + vec2(0, -uProgress/SHOWER_TIME);
        
        vec2 streakScale = vec2(0.1, 0.002) * vec2(uSizeX, uSizeY);
        vec2 streakUV = uv * streakScale;
        float streaks = noise2D(streakUV, 5) * 0.5 * masks.y;
        cogl_color_out.rgb += effectColor * streaks;

        float sparks = 0.0;
        float sparkScale = 5.0;
        for (int i=0; i<SPARK_LAYERS; ++i) {
          sparks += getSparks(uv / sparkScale, SPARK_SPACING, SEED * (i+1));
        }
        cogl_color_out.rgb += effectColor * sparks * masks.x;

        // float edgeFadeWidth = 0.5;
        // float heartMask     = 1.0;
        // float heart         = 0.0;
        // heartMask *= smoothstep(0, 1, clamp(cogl_tex_coord_in[0].x / edgeFadeWidth, 0, 1));
        // heartMask *= smoothstep(0, 1, clamp(cogl_tex_coord_in[0].y / edgeFadeWidth, 0, 1));
        // heartMask *= smoothstep(0, 1, clamp((1.0 - cogl_tex_coord_in[0].x) / edgeFadeWidth, 0, 1));
        // heartMask *= smoothstep(0, 1, clamp((1.0 - cogl_tex_coord_in[0].y) / edgeFadeWidth, 0, 1));

        // heartMask = pow(heartMask, 10.0);

        // for (int i=0; i<SPARK_LAYERS; ++i) {
        //   heart += heartMask * getSparks((cogl_tex_coord_in[0].st-0.5) / mix(2.0, 1.0, uProgress), SPARK_SPACING, SEED * (i+1+SPARK_LAYERS));
        // }
        
        // These are pretty useful for understanding how this works.
        // cogl_color_out = vec4(streakMask, 0.0, 1.0);
        // cogl_color_out = vec4(vec3(streaks), 1.0);
      }
      `);
    };
  });
}