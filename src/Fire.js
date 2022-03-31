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

const {Gio, GObject} = imports.gi;

const _ = imports.gettext.domain('burn-my-windows').gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This effect is a homage to the good old Compiz days. However, it is implemented      //
// quite differently. While Compiz used a particle system, this effect uses a noise     //
// shader. The noise is moved  vertically over time and mapped to a configurable color  //
// gradient. It is faded to transparency towards the edges of the window. In addition,  //
// there are a couple of moving gradients which fade-in or fade-out the fire effect.    //
//////////////////////////////////////////////////////////////////////////////////////////

// The shader class for this effect is registered further down in this file.
let Shader = null;

// The effect class is completely static. It can be used to get some metadata (like the
// effect's name or supported GNOME Shell versions), to initialize the respective page of
// the settings dialog, as well as to create the actual shader for the effect.
var Fire = class Fire {

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
    return 'fire';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('Fire');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog. It loads the settings page for this effect,
  // binds all properties to the settings and appends the page to the main stack of the
  // preferences dialog.
  static getPreferences(dialog) {

    // Add the settings page to the builder.
    dialog.getBuilder().add_from_resource(`/ui/${utils.getGTKString()}/Fire.ui`);

    // Bind all properties.
    dialog.bindAdjustment('fire-animation-time');
    dialog.bindAdjustment('flame-movement-speed');
    dialog.bindAdjustment('flame-scale');
    dialog.bindSwitch('flame-3d-noise');
    dialog.bindColorButton('fire-color-1');
    dialog.bindColorButton('fire-color-2');
    dialog.bindColorButton('fire-color-3');
    dialog.bindColorButton('fire-color-4');
    dialog.bindColorButton('fire-color-5');

    // The fire-gradient-reset button needs to be bound explicitly.
    dialog.getBuilder().get_object('reset-fire-colors').connect('clicked', () => {
      dialog.getSettings().reset('fire-color-1');
      dialog.getSettings().reset('fire-color-2');
      dialog.getSettings().reset('fire-color-3');
      dialog.getSettings().reset('fire-color-4');
      dialog.getSettings().reset('fire-color-5');
    });

    // Initialize the fire-preset dropdown.
    Fire._createFirePresets(dialog);

    // Finally, return the new settings page.
    return dialog.getBuilder().get_object('fire-prefs');
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is closed with this effect.
  static createShader(actor, settings, forOpening) {
    return new Shader(settings, forOpening);
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
      'opacity': {from: 255, to: 255, mode: 3},
      'scale-x': {from: 1.0, to: 1.0, mode: 3},
      'scale-y': {from: 1.0, to: 1.0, mode: 3}
    };
  }

  // ----------------------------------------------------------------------- private stuff

  // This populates the preset dropdown menu for the fire options.
  static _createFirePresets(dialog) {
    dialog.getBuilder().get_object('fire-prefs').connect('realize', (widget) => {
      const presets = [
        {
          name: _('Default Fire'),
          scale: 1.0,
          speed: 0.5,
          color1: 'rgba(76, 51, 25, 0.0)',
          color2: 'rgba(180, 55, 30, 0.7)',
          color3: 'rgba(255, 76, 38, 0.9)',
          color4: 'rgba(255, 166, 25, 1)',
          color5: 'rgba(255, 255, 255, 1)'
        },
        {
          name: _('Hell Fire'),
          scale: 1.5,
          speed: 0.2,
          color1: 'rgba(0,0,0,0)',
          color2: 'rgba(103,7,80,0.5)',
          color3: 'rgba(150,0,24,0.9)',
          color4: 'rgb(255,200,0)',
          color5: 'rgba(255, 255, 255, 1)'
        },
        {
          name: _('Dark and Smutty'),
          scale: 1.0,
          speed: 0.5,
          color1: 'rgba(0,0,0,0)',
          color2: 'rgba(36,3,0,0.5)',
          color3: 'rgba(150,0,24,0.9)',
          color4: 'rgb(255,177,21)',
          color5: 'rgb(255,238,166)'
        },
        {
          name: _('Cold Breeze'),
          scale: 1.5,
          speed: -0.1,
          color1: 'rgba(0,110,255,0)',
          color2: 'rgba(30,111,180,0.24)',
          color3: 'rgba(38,181,255,0.54)',
          color4: 'rgba(34,162,255,0.84)',
          color5: 'rgb(97,189,255)'
        },
        {
          name: _('Santa is Coming'),
          scale: 0.4,
          speed: -0.5,
          color1: 'rgba(0,110,255,0)',
          color2: 'rgba(208,233,255,0.24)',
          color3: 'rgba(207,235,255,0.84)',
          color4: 'rgb(208,243,255)',
          color5: 'rgb(255,255,255)'
        }
      ];

      const menu      = Gio.Menu.new();
      const group     = Gio.SimpleActionGroup.new();
      const groupName = 'presets';

      // Add all presets.
      presets.forEach((preset, i) => {
        const actionName = 'fire' + i;
        menu.append(preset.name, groupName + '.' + actionName);
        let action = Gio.SimpleAction.new(actionName, null);

        // Load the preset on activation.
        action.connect('activate', () => {
          dialog.getSettings().set_double('flame-movement-speed', preset.speed);
          dialog.getSettings().set_double('flame-scale', preset.scale);
          dialog.getSettings().set_string('fire-color-1', preset.color1);
          dialog.getSettings().set_string('fire-color-2', preset.color2);
          dialog.getSettings().set_string('fire-color-3', preset.color3);
          dialog.getSettings().set_string('fire-color-4', preset.color4);
          dialog.getSettings().set_string('fire-color-5', preset.color5);
        });

        group.add_action(action);
      });

      dialog.getBuilder().get_object('fire-preset-button').set_menu_model(menu);

      const root = utils.isGTK4() ? widget.get_root() : widget.get_toplevel();
      root.insert_action_group(groupName, group);
    });
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
    _init(settings, forOpening) {
      super._init({shader_type: Clutter.ShaderType.FRAGMENT_SHADER});

      // Load the gradient values from the settings. We directly inject the values in the
      // GLSL code below. The shader is compiled once for each window-closing anyways. In
      // the future, we may want to prevent this frequent recompilations of shaders,
      // though.
      const gradient = [];
      for (let i = 1; i <= 5; i++) {
        const color =
          Clutter.Color.from_string(settings.get_string('fire-color-' + i))[1];
        gradient.push(`vec4(${color.red / 255}, ${color.green / 255}, ${
          color.blue / 255}, ${color.alpha / 255})`);
      }

      this.set_shader_source(`

        // Inject some common shader snippets.
        ${shaderSnippets.standardUniforms()}
        ${shaderSnippets.noise()}
        ${shaderSnippets.edgeMask()}

        // These may be configurable in the future.
        const float EDGE_FADE  = 70;
        const float FADE_WIDTH = 0.1;
        const float HIDE_TIME  = 0.4;
        const vec2  FIRE_SCALE = vec2(400, 600) * ${settings.get_double('flame-scale')};
        const float FIRE_SPEED = ${settings.get_double('flame-movement-speed')};

        // This maps the input value from [0..1] to a color from the gradient.
        vec4 getFireColor(float v) {
          const float steps[5] = float[](0.0, 0.2, 0.35, 0.5, 0.8);
          const vec4 colors[5] = vec4[](
            ${gradient[0]},
            ${gradient[1]},
            ${gradient[2]},
            ${gradient[3]},
            ${gradient[4]}
          );

          if (v < steps[0]) {
            return colors[0];
          }

          for (int i=0; i<4; ++i) {
            if (v <= steps[i+1]) {
              return mix(colors[i], colors[i+1], vec4(v - steps[i])/(steps[i+1]-steps[i]));
            }
          }

          return colors[4];
        }

        // This method requires the uniforms from standardUniforms() to be available.
        // It returns two values: The first is an alpha value which can be used for the window
        // texture. This gradually dissolves the window from top to bottom. The second can be used
        // to mask any effect, it will be most opaque where the window is currently fading and
        // gradually dissolve to zero over time.
        // hideTime:      A value in [0..1]. It determines the percentage of the animation which
        //                is spent for hiding the window. 1-hideTime will be spent thereafter for
        //                dissolving the effect mask.
        // fadeWidth:     The relative size of the window-hiding gradient in [0..1].
        // edgeFadeWidth: The pixel width of the effect fading range at the edges of the window.
        vec2 effectMask(float hideTime, float fadeWidth, float edgeFadeWidth) {
          float burnProgress      = clamp(uProgress/hideTime, 0, 1);
          float afterBurnProgress = clamp((uProgress-hideTime)/(1-hideTime), 0, 1);

          // Gradient from top to bottom.
          float t = cogl_tex_coord_in[0].t * (1 - fadeWidth);

          // Visible part of the window. Gradually dissolves towards the bottom.
          float windowMask = 1 - clamp((burnProgress - t) / fadeWidth, 0, 1);

          // Gradient from top burning window.
          float effectMask = clamp(t*(1-windowMask)/burnProgress, 0, 1);

          // Fade-out when the window burned down.
          if (uProgress > hideTime) {
            float fade = sqrt(1-afterBurnProgress*afterBurnProgress);
            effectMask *= mix(1, 1-t, afterBurnProgress) * fade;
          }

          // Fade at window borders.
          effectMask *= getAbsoluteEdgeMask(edgeFadeWidth);

          #if ${forOpening ? '1' : '0'}
            windowMask = 1.0 - windowMask;
          #endif

          return vec2(windowMask, effectMask);
        }

        void main() {

          // Get a noise value which moves vertically in time.
          vec2 uv = cogl_tex_coord_in[0].st * vec2(uSizeX, uSizeY) / FIRE_SCALE;
          uv.y += uTime * FIRE_SPEED;

          #if ${settings.get_boolean('flame-3d-noise') ? 1 : 0}
            float noise = simplex3DFractal(vec3(uv*4.0, uTime*FIRE_SPEED*1.5));
          #else
            float noise = simplex2DFractal(uv * 4.0);
          #endif

          // Modulate noise by effect mask.
          vec2 effectMask = effectMask(HIDE_TIME, FADE_WIDTH, EDGE_FADE);
          noise *= effectMask.y;

          // Map noise value to color.
          vec4 fire = getFireColor(noise);
          fire.rgb *= fire.a;

          // Get the window texture and fade it according to the effect mask.
          cogl_color_out = texture2D(uTexture, cogl_tex_coord_in[0].st) * effectMask.x;

          // Add the fire to the window.
          cogl_color_out = cogl_color_out * (1.0 - fire.a) + fire;

          // These are pretty useful for understanding how this works.
          // cogl_color_out = vec4(vec3(noise), 1);
          // cogl_color_out = vec4(vec3(effectMask.x), 1);
          // cogl_color_out = vec4(vec3(effectMask.y), 1);
        }
      `);
    };
  });
}