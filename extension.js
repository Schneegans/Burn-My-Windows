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

const Workspace                  = imports.ui.workspace.Workspace;
const WindowManager              = imports.ui.windowManager.WindowManager;
const WINDOW_REPOSITIONING_DELAY = imports.ui.workspace.WINDOW_REPOSITIONING_DELAY;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This extensions modifies the window-close animation to look like the window was set  //
// on fire. While this is definitely a homage to the good old Compiz plugin, it is      //
// implemented differently. While Compiz used a particle system, this extension uses a  //
// perlin noise shader.                                                                 //
//////////////////////////////////////////////////////////////////////////////////////////

class Extension {

  // ------------------------------------------------------------------------ public stuff

  // This function could be called after the extension is enabled, which could be done
  // from GNOME Tweaks, when you log in or when the screen is unlocked.
  enable() {

    // Store a reference to the settings object.
    this._settings = ExtensionUtils.getSettings();

    // We will monkey-patch these three methods. Let's store the original ones.
    this._origWindowRemoved      = Workspace.prototype._windowRemoved;
    this._origDoRemoveWindow     = Workspace.prototype._doRemoveWindow;
    this._origShouldAnimateActor = WindowManager.prototype._shouldAnimateActor;

    // We may also override these animation times.
    this._origDestroyTime = imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME;

    const loadAnimationTimes = () => {
      imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME =
          this._settings.get_int('destroy-animation-time');
    };

    this._settings.connect('changed::destroy-animation-time', loadAnimationTimes);
    loadAnimationTimes();

    // We will use extensionThis to refer to the extension inside the patched methods of
    // the WorkspacesView.
    const extensionThis = this;

    // These three method overrides are mega-hacky! They are only required to make the
    // fire animation work in the overview. Usually, windows are not faded when closed
    // from the overview (why?). With these overrides we make sure that they are actually
    // faded out. To do this, _windowRemoved and _doRemoveWindow now check whether there
    // is a transition ongoing (via extensionThis._shouldDestroy). If that's the case,
    // they methods do nothing. Are the actors removed in the end? I hope so. The
    // _destroyWindow of the WindowManager sets the transitions up and should take care of
    // removing the actors at the end of the transitions.
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/workspace.js#L1299
    Workspace.prototype._windowRemoved = function(ws, metaWin) {
      if (extensionThis._shouldDestroy(this, metaWin)) {
        extensionThis._origWindowRemoved.apply(this, [ws, metaWin]);
      }
    };

    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/workspace.js#L1178
    Workspace.prototype._doRemoveWindow = function(metaWin) {
      if (extensionThis._shouldDestroy(this, metaWin)) {
        extensionThis._origDoRemoveWindow.apply(this, [metaWin]);
      }
    };

    // Here comes the ULTRA-HACK: The method below is called (amongst others) by the
    // _destroyWindow method of the WindowManager. Usually, it returns false when we are
    // in the overview. This prevents the window-close animation. As we cannot
    // monkey-patch the _destroyWindow method itself, we check inside the method below
    // whether it was called by _destroyWindow. If so, we return true. Let's see if this
    // breaks stuff left and right...
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1125
    WindowManager.prototype._shouldAnimateActor = function(actor, types) {
      if ((new Error()).stack.split('\n')[1].includes('_destroyWindow@')) {
        return true;
      }
      return extensionThis._origShouldAnimateActor.apply(this, [actor, types]);
    };

    // The close animation is set up in WindowManager's _destroyWindow:
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1549
    // As we cannot monkey-patch the _destroyWindow itself, we connect to the 'destroy'
    // signal of the window manager and tweak the animation to our needs.
    this._destroyConnection = global.window_manager.connect('destroy', (wm, actor) => {
      // The _destroyWindow method of WindowManager, which was called right before this
      // one, set up the window close animation. This usually fades-out the window and
      // scales it a bit down. If no transition is in progress, something unexpected
      // happened. We rather try not to burn the window!
      const transition = actor.get_transition('opacity');
      if (!transition) {
        return;
      }

      // If there's a transition in progress, we re-target these transitions so that the
      // window is neither scaled nor faded.
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

      // Instead, we add a cool fire shader to our window actor! The noise implementation
      // is from https://www.shadertoy.com/view/3tcBzH (CC-BY-NC-SA).
      const shader = new Clutter.ShaderEffect({
        shader_type: Clutter.ShaderType.FRAGMENT_SHADER,
      });

      shader.set_shader_source(`
        uniform sampler2D texture;
        uniform float     progress;
        uniform float     time;
        uniform int       sizeX;
        uniform int       sizeY;

        // These may be configurable in the future.
        const float EDGE_BLEND = 70;
        const float BURN_RANGE = 0.1;
        const float BURN_TIME  = 0.2;
        const vec2  FIRE_SCALE = vec2(400, 600);
        const float FIRE_SPEED = 0.5;

        float rand(vec2 co) {
          return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }
        
        float hermite(float t) {
          return t * t * (3.0 - 2.0 * t);
        }
        
        float noiseImpl(vec2 co, float frequency) {
          vec2 v = vec2(co.x * frequency, co.y * frequency);
        
          float ix1 = floor(v.x);
          float iy1 = floor(v.y);
          float ix2 = floor(v.x + 1.0);
          float iy2 = floor(v.y + 1.0);
        
          float fx = hermite(fract(v.x));
          float fy = hermite(fract(v.y));
        
          float fade1 = mix(rand(vec2(ix1, iy1)), rand(vec2(ix2, iy1)), fx);
          float fade2 = mix(rand(vec2(ix1, iy2)), rand(vec2(ix2, iy2)), fx);
        
          return mix(fade1, fade2, fy);
        }
        
        float pNoise(vec2 co, float freq, int steps, float persistence) {
          float value = 0.0;
          float ampl = 1.0;
          float sum = 0.0;
          for(int i=0 ; i<steps ; i++) {
            sum += ampl;
            value += noiseImpl(co, freq) * ampl;
            freq *= 2.0;
            ampl *= persistence;
          }
          return value / sum;
        }

        vec4 getFireColor(float v) {
          const float steps[5] = float[](0.0, 0.2, 0.3, 0.5, 1.0);
          const vec4 colors[5] = vec4[](
            vec4(0.3, 0.2, 0.1,  0.0),
            vec4(1.0, 0.3, 0.15, 0.7),
            vec4(1.0, 0.3, 0.15, 0.9),
            vec4(1.0, 0.65, 0.1, 1.0),
            vec4(1, 1, 1, 1.0)
          );

          for (int i=0; i<4; ++i) {
            if (v <= steps[i+1]) {
              return mix(colors[i], colors[i+1], vec4(v - steps[i])/(steps[i+1]-steps[i]));
            }
          }
        }

        void main(void) {
          float burnProgress      = clamp(progress/BURN_TIME, 0, 1);
          float afterBurnProgress = clamp((progress-BURN_TIME)/(1-BURN_TIME), 0, 1);

          // Gradient from top to bottom.
          float t = cogl_tex_coord_in[0].t * (1 - BURN_RANGE);

          // Visible part of the window. Gradually dissolves towards the bottom.
          float alpha = 1 - clamp((burnProgress - t) / BURN_RANGE, 0, 1);

          // Get window texture.
          cogl_color_out = texture2D(texture, cogl_tex_coord_in[0].st) * alpha;

          // Gradient from top burning window.
          float mask = clamp(t*(1-alpha)/burnProgress, 0, 1);

          // Fade-out when the window burned down.
          if (progress > BURN_TIME) {
            mask *= mix(1, 1-t, afterBurnProgress) * pow(1-afterBurnProgress, 2);
          }

          // Fade at window borders.
          vec2 pos = cogl_tex_coord_in[0].st * vec2(sizeX, sizeY);
          mask *= clamp(pos.x / EDGE_BLEND, 0, 1);
          mask *= clamp(pos.y / EDGE_BLEND, 0, 1);
          mask *= clamp((sizeX - pos.x) / EDGE_BLEND, 0, 1);
          mask *= clamp((sizeY - pos.y) / EDGE_BLEND, 0, 1);

          vec2 firePos = pos / FIRE_SCALE;
          firePos.y += time * FIRE_SPEED;
          float noise = pNoise(firePos, 10.0, 5, 0.5);
          
          // Modulate noise by mask and map to color.
          vec4 color = getFireColor(noise*mask);
          color.rgb *= color.a;

          // cogl_color_out = vec4(mask);
          cogl_color_out += color;
        }
      `);

      actor.add_effect(shader);

      // Update uniforms at each frame.
      transition.connect('new-frame', (t) => {
        shader.set_uniform_value('progress', t.get_progress());
        shader.set_uniform_value('time', 0.001 * t.get_elapsed_time());
        shader.set_uniform_value('sizeX', actor.width);
        shader.set_uniform_value('sizeY', actor.height);
      });
    });
  }

  // This function could be called after the extension is uninstalled, disabled in GNOME
  // Tweaks, when you log out or when the screen locks.
  disable() {

    // Restore the original behavior.
    global.window_manager.disconnect(this._destroyConnection);

    Workspace.prototype._windowRemoved          = this._origWindowRemoved;
    Workspace.prototype._doRemoveWindow         = this._origDoRemoveWindow;
    WindowManager.prototype._shouldAnimateActor = this._origShouldAnimateActor;

    imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME = this._origDestroyTime;

    this._settings = null;
  }

  // ----------------------------------------------------------------------- private stuff

  _shouldDestroy(workspace, metaWindow) {
    const index = workspace._lookupIndex(metaWindow);
    if (index == -1) {
      return true;
    }

    const actor = workspace._windows[index]._windowActor;
    if (!actor.get_transition('opacity')) {
      return true;
    }

    return false;
  }
}

// This function is called once when the extension is loaded, not enabled.
function init() {
  return new Extension();
}
