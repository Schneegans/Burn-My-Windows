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
const utils          = Me.imports.src.common.utils;
const FireShader     = Me.imports.src.extension.FireShader.FireShader;

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

      // Instead, we add a cool shader to our window actor!
      const shader = new FireShader(this._settings);
      actor.add_effect(shader);

      // Update uniforms at each frame.
      transition.connect('new-frame', (t) => {
        shader.set_uniform_value('uProgress', t.get_progress());
        shader.set_uniform_value('uTime', 0.001 * t.get_elapsed_time());
        shader.set_uniform_value('uSizeX', actor.width);
        shader.set_uniform_value('uSizeY', actor.height);
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
