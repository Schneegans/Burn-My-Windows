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

const {Clutter} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.utils;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

class Extension {
  // The constructor is called once when the extension is loaded, not enabled.
  constructor() {}

  // ------------------------------------------------------------------------ public stuff

  // This function could be called after the extension is enabled, which could be done
  // from GNOME Tweaks, when you log in or when the screen is unlocked.
  enable() {

    // imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME = 2000;

    // Store a reference to the settings object.
    // this._settings = ExtensionUtils.getSettings();

    this._destroyConnection = global.window_manager.connect('destroy', (wm, actor) => {
      const tweakTransition = (property, value) => {
        const transition = actor.get_transition(property);
        if (transition) {
          transition.set_to(value);
          transition.set_progress_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
        }
      };

      tweakTransition('opacity', 255);
      tweakTransition('scale-x', 1);
      tweakTransition('scale-y', 1);

      const shader = new Clutter.ShaderEffect({
        shader_type: Clutter.ShaderType.FRAGMENT_SHADER,
      });

      shader.set_shader_source(`
        uniform sampler2D texture;
        uniform float     progress;

        const float BLEND_RANGE = 0.1;

        void main(void) {
          float t = cogl_tex_coord_in[0].t * (1 - BLEND_RANGE);
          float alpha = 1 - clamp((progress - t) / BLEND_RANGE, 0, 1);

          // This uses premultiplied alpha.
          cogl_color_out = texture2D(texture, cogl_tex_coord_in[0].st) * alpha;
        }
      `);

      actor.add_effect(shader);

      const transition = actor.get_transition('opacity');
      transition.connect('new-frame', (t) => {
        shader.set_uniform_value('progress', t.get_progress());
      });
    });
  }

  // This function could be called after the extension is uninstalled, disabled in GNOME
  // Tweaks, when you log out or when the screen locks.
  disable() {

    // Restore the original behavior.
    global.window_manager.disconnect(this._destroyConnection);

    // this._settings = null;
  }

  // ----------------------------------------------------------------------- private stuff
}

// This function is called once when the extension is loaded, not enabled.
function init() {
  return new Extension();
}
