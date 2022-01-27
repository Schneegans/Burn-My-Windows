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

const {Clutter, Gio, Meta} = imports.gi;

const Main          = imports.ui.main;
const Workspace     = imports.ui.workspace.Workspace;
const WindowManager = imports.ui.windowManager.WindowManager;

// The WindowPreview class is only available on GNOME Shell 3.38+;
let WindowPreview = null;
try {
  WindowPreview = imports.ui.windowPreview.WindowPreview;
} catch (error) {
  // Nothing to be done, we are on GNOME Shell 3.36.
}

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;

// New effects must be registered here and in prefs.js.
const ALL_EFFECTS = [
  Me.imports.src.EnergizeA.EnergizeA,
  Me.imports.src.EnergizeB.EnergizeB,
  Me.imports.src.Fire.Fire,
  Me.imports.src.Matrix.Matrix,
  Me.imports.src.BrokenGlass.BrokenGlass,
  Me.imports.src.TRexAttack.TRexAttack,
  Me.imports.src.TVEffect.TVEffect,
  Me.imports.src.Wisps.Wisps,
];

//////////////////////////////////////////////////////////////////////////////////////////
// This extensions modifies the window-close and window-open animations with all kinds  //
// of effects. The effects are implemented using GLSL shaders which are applied to the  //
// window's Clutter.Actor. The extension is actually very simple, much of the           //
// complexity comes from the fact that GNOME Shell usually does not show an animation   //
// when a window is closed in the overview. Several methods need to be monkey-patched   //
// to get this working. For more details, read the other comments in this file...       //
//////////////////////////////////////////////////////////////////////////////////////////

class Extension {

  // ------------------------------------------------------------------------ public stuff

  // This function could be called after the extension is enabled, which could be done
  // from GNOME Tweaks, when you log in or when the screen is unlocked.
  enable() {

    // Load all of our resources.
    this._resources = Gio.Resource.load(Me.path + '/resources/burn-my-windows.gresource');
    Gio.resources_register(this._resources);

    // Store a reference to the settings object.
    this._settings = ExtensionUtils.getSettings();

    // This will store an item of ALL_EFFECTS which was used the last time a window was
    // opened / closed.
    this._currentEffect = 0;

    // We will use extensionThis to refer to the extension inside the patched methods.
    const extensionThis = this;

    // We will monkey-patch these methods. Let's store the original ones.
    this._origAddWindowClone     = Workspace.prototype._addWindowClone;
    this._origWindowRemoved      = Workspace.prototype._windowRemoved;
    this._origDoRemoveWindow     = Workspace.prototype._doRemoveWindow;
    this._origShouldAnimateActor = WindowManager.prototype._shouldAnimateActor;

    // We will also override these animation times.
    this._origWindowTime = imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME;
    this._origDialogTime = imports.ui.windowManager.DIALOG_DESTROY_WINDOW_ANIMATION_TIME;

    Workspace.prototype._addWindowClone = function(...params) {
      const result     = extensionThis._origAddWindowClone.apply(this, params);
      const realWindow = params[0].get_compositor_private();

      let clone;

      if (utils.shellVersionIs(3, 36)) {
        clone = result[0];
      } else if (utils.shellVersionIs(3, 38)) {
        clone = result._windowContainer;
      } else {
        clone = result.window_container;
      }

      const xID = realWindow.connect('notify::scale-x', () => {
        if (realWindow.scale_x > 0) {
          clone.scale_x = realWindow.scale_x;
        }
      });

      const yID = realWindow.connect('notify::scale-y', () => {
        if (realWindow.scale_y > 0) {
          clone.scale_y = realWindow.scale_y;
        }
      });

      clone.connect('destroy', () => {
        realWindow.disconnect(xID);
        realWindow.disconnect(yID);
      });

      // On GNOME 3.36, the window clone's 'destroy' handler only calls _removeWindowClone
      // but not _doRemoveWindow. The latter is required to trigger the repositioning of
      // the overview window layout. Therefore we call this method in addition.
      // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/gnome-3-36/js/ui/workspace.js#L1877
      // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/workspace.js#L1415
      if (utils.shellVersionIs(3, 36)) {
        clone.connect('destroy', () => this._doRemoveWindow(clone.metaWindow));
      }

      return result;
    };

    this._windowCreatedConnection =
        global.display.connect('window-created', (d, metaWin) => {
          let actor = metaWin.get_compositor_private();

          if (Main.overview.visible && !Main.overview.closing) {
            utils.debug('window-created: setup effect on show');
            const id = actor.connect('show', () => {
              extensionThis._setupEffect(actor, true);
              actor.disconnect(id);
            });

          } else {

            utils.debug('window-created: setup effect on ease');
            const orig = actor.ease;
            actor.ease = function(...params) {
              orig.apply(actor, params);
              actor.ease = orig;

              extensionThis._setupEffect(actor, true);
            };
          }
        });



    // This class is only available in GNOME Shell 3.38+. So no transition tweaking in
    // GNOME Shell 3.36, but this is not used by any effect available there anyways for
    // now...
    if (WindowPreview) {
      this._origDeleteAll = WindowPreview.prototype._deleteAll;
      this._origRestack   = WindowPreview.prototype._restack;
      this._origInit      = WindowPreview.prototype._init;

      // This is required, else WindowPreview's _restack() which is called by the
      // "this.overlayEnabled = false", sometimes tries to access an already delete
      // WindowPreview.
      WindowPreview.prototype._restack = function() {
        if (!this._closeRequested) {
          // Call the original method.
          extensionThis._origRestack.apply(this);
        }
      };

      WindowPreview.prototype._init = function(...params) {
        // Call the original method.
        extensionThis._origInit.apply(this, params);

        const connectionID = this.metaWindow.connect('unmanaged', () => {
          if (this.window_container) {
            // Hide the window's icon, name, and close button.
            this.overlayEnabled = false;
            this._icon.visible  = false;
          }
        });

        // Make sure to not call the callback above if the Meta.Window was not unmanaged
        // before leaving the overview.
        this.connect('destroy', () => {
          this.metaWindow.disconnect(connectionID);
        });
      };

      // The _deleteAll is called when the user clicks the X in the overview. We should
      // not attempt to close windows twice. Due to the animation in the overview, the
      // close button can be clicked twice which normally would lead to a crash.
      WindowPreview.prototype._deleteAll = function() {
        if (!this._closeRequested) {
          extensionThis._origDeleteAll.apply(this);
        }
      };
    }

    // These three method overrides are mega-hacky! They are only required to make the
    // fire animation work in the overview. Usually, windows are not faded when closed
    // from the overview (why?). With these overrides we make sure that they are actually
    // faded out. To do this, _windowRemoved and _doRemoveWindow now check whether there
    // is a transition ongoing (via extensionThis._shouldDestroy). If that's the case,
    // these methods do nothing. Are the actors removed in the end? I hope so. The
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
    WindowManager.prototype._shouldAnimateActor = function(...params) {
      if ((new Error()).stack.split('\n')[1].includes('_destroyWindow@')) {
        return true;
      }
      return extensionThis._origShouldAnimateActor.apply(this, params);
    };

    // The close animation is set up in WindowManager's _destroyWindow:
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1549
    // As we cannot monkey-patch the _destroyWindow itself, we connect to the 'destroy'
    // signal of the window manager and tweak the animation to our needs.
    this._destroyConnection = global.window_manager.connect('destroy', (wm, actor) => {
      this._setupEffect(actor, false);
    });
  }

  // This function could be called after the extension is uninstalled, disabled in GNOME
  // Tweaks, when you log out or when the screen locks.
  disable() {

    // Unregister our resources.
    Gio.resources_unregister(this._resources);

    // Restore the original window-open and window-close animations.
    global.window_manager.disconnect(this._destroyConnection);
    global.display.disconnect(this._windowCreatedConnection);

    Workspace.prototype._addWindowClone         = this._origAddWindowClone;
    Workspace.prototype._windowRemoved          = this._origWindowRemoved;
    Workspace.prototype._doRemoveWindow         = this._origDoRemoveWindow;
    WindowManager.prototype._shouldAnimateActor = this._origShouldAnimateActor;

    imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME        = this._origWindowTime;
    imports.ui.windowManager.DIALOG_DESTROY_WINDOW_ANIMATION_TIME = this._origDialogTime;

    if (WindowPreview) {
      WindowPreview.prototype._deleteAll = this._origDeleteAll;
      WindowPreview.prototype._restack   = this._origRestack;
      WindowPreview.prototype._init      = this._origInit;
    }

    this._settings = null;
  }

  // ----------------------------------------------------------------------- private stuff

  _setupEffect(actor, forOpening) {
    const isNormalWindow = actor.meta_window.window_type == Meta.WindowType.NORMAL;
    const isDialogWindow =
        actor.meta_window.window_type == Meta.WindowType.MODAL_DIALOG ||
        actor.meta_window.window_type == Meta.WindowType.DIALOG;

    if (!isNormalWindow && !isDialogWindow) {
      return;
    }

    // We do nothing if a dialog got closed and we should not burn them.
    const shouldDestroyDialogs = this._settings.get_boolean('destroy-dialogs');

    // If an effect is to be previewed, we have to affect dialogs es well. This is
    // because the preview window is a dialog window...
    const action      = forOpening ? 'open' : 'close';
    const previewNick = this._settings.get_string(action + '-preview-effect');

    if (isDialogWindow && !shouldDestroyDialogs && previewNick == '') {
      this._fixAnimationTimes(isDialogWindow, forOpening, null);
      return;
    }

    // ------------------------------------------------------------------ choose an effect

    this._currentEffect = null;

    if (previewNick != '') {
      this._currentEffect = ALL_EFFECTS.find(Effect => {
        return Effect.getNick() == previewNick;
      });

      // Only preview the effect once.
      this._settings.set_string(action + '-preview-effect', '');

    } else {

      // Else we choose a random effect from all enabled effects. Therefore, we first
      // create a list of all currently enabled effects.
      const enabled = ALL_EFFECTS.filter(Effect => {
        return this._settings.get_boolean(`${Effect.getNick()}-${action}-effect`);
      });

      // And then choose a random effect.
      if (enabled.length > 0) {
        this._currentEffect = enabled[Math.floor(Math.random() * enabled.length)];
      }
    }

    // If nothing was enabled, we have to do nothing :)
    if (this._currentEffect == null) {
      this._fixAnimationTimes(isDialogWindow, forOpening, null);
      return;
    }

    // ----------------------------------------------------------- tweak actor transitions

    // This is used to tweak the ongoing transitions of a window actor. This is either the
    // actual actor of the Meta.Window or a clone in the overview. Usually windows are
    // faded in / out scaled up / down slightly by GNOME Shell. Here, we allow
    // modifications to this behavior by the effects. The given config object is created
    // by the effect's tweakTransition() method.
    const config = this._currentEffect.tweakTransition(actor, this._settings, forOpening);
    const duration =
        this._settings.get_int(this._currentEffect.getNick() + '-animation-time');

    actor.set_pivot_point(0.5, 0.5);

    for (const property in config) {
      const from = config[property].from;
      const to   = config[property].to;
      const mode = config[property].mode;

      let transition = actor.get_transition(property);

      if (!transition) {
        actor.set_property(property, 0);
        actor.save_easing_state();
        actor.set_easing_duration(1000);
        actor.set_property(property, 1);
        actor.restore_easing_state();

        transition = actor.get_transition(property);
      }

      if (!transition) {
        this._fixAnimationTimes(isDialogWindow, forOpening, null);
        return;
      }

      transition.set_duration(duration);
      transition.set_to(to);
      transition.set_from(from);
      transition.set_progress_mode(mode);
    }

    const transition = actor.get_transition('scale-y');
    transition.connect('completed', () => {
      actor.scale_x = 1.0;
      actor.scale_y = 1.0;
    });

    // -------------------------------------------------------------------- add the shader

    // Add a cool shader to our window actor!
    const shader = this._currentEffect.createShader(actor, this._settings, forOpening);

    if (shader) {
      actor.remove_effect_by_name(`burn-my-windows-effect`);
      actor.add_effect_with_name(`burn-my-windows-effect`, shader);

      // Update uniforms at each frame.
      transition.connect('new-frame', (t) => {
        shader.set_uniform_value('uProgress', t.get_progress());
        shader.set_uniform_value('uTime', 0.001 * t.get_elapsed_time());
        shader.set_uniform_value('uSizeX', actor.width);
        shader.set_uniform_value('uSizeY', actor.height);
      });

      transition.connect('completed', () => {
        actor.remove_effect_by_name(`burn-my-windows-effect`);
      });
    }

    this._fixAnimationTimes(isDialogWindow, forOpening, duration);
  }

  // The code below is not necessary for Burn-My-Windows to function. However, there
  // are some extensions such as "Show Application View When Workspace Empty"
  // https://extensions.gnome.org/extension/2036/show-application-view-when-workspace-empty/
  // which do something *after* a window was closed. As the window-close animation
  // duration depends on the used effect, this may vary each time a window is
  // closed. We set the currently used time here, so that others can get an idea how
  // long this will take...
  _fixAnimationTimes(isDialogWindow, forOpening, duration) {
    if (!forOpening) {
      if (isDialogWindow) {
        imports.ui.windowManager.DIALOG_DESTROY_WINDOW_ANIMATION_TIME =
            duration != null ? duration : this._origDialogTime;
      } else {
        imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME =
            duration != null ? duration : this._origWindowTime;
      }
    }
  }

  // This is required to enable window-close animations in the overview. See the comment
  // for Workspace.prototype._windowRemoved above for an explanation.
  _shouldDestroy(workspace, metaWindow) {
    const index = workspace._lookupIndex(metaWindow);
    if (index == -1) {
      return true;
    }

    // This was called "realWindow" in GNOME 3.36.
    const propertyName = utils.shellVersionIs(3, 36) ? 'realWindow' : '_windowActor';
    const actor        = workspace._windows[index][propertyName];
    if (!actor.get_transition('scale-y')) {
      return true;
    }

    return false;
  }
}

// This function is called once when the extension is loaded, not enabled.
function init() {
  return new Extension();
}
