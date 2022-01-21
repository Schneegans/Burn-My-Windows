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
// This extensions modifies the window-close animation to look like the window was set  //
// on fire. There are also a few other effects available. All of them are implemented   //
// using GLSL shaders which are applied to the window's Clutter.Actor. The extension is //
// actually very simple, most of the complexity comes from the fact that GNOME Shell    //
// usually does not show an animation when a window is closed in the overview. Several  //
// methods need to be monkey-patched to get this working. For more details, read the    //
// other comments in this file...                                                       //
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
    // closed.
    this._effect = 0;

    // We will monkey-patch these three methods. Let's store the original ones.
    this._origWindowRemoved      = Workspace.prototype._windowRemoved;
    this._origDoRemoveWindow     = Workspace.prototype._doRemoveWindow;
    this._origAddWindowClone     = Workspace.prototype._addWindowClone;
    this._origShouldAnimateActor = WindowManager.prototype._shouldAnimateActor;

    // We will also override these animation times.
    this._origWindowTime = imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME;
    this._origDialogTime = imports.ui.windowManager.DIALOG_DESTROY_WINDOW_ANIMATION_TIME;

    // We will use extensionThis to refer to the extension inside the patched methods of
    // the WorkspacesView.
    const extensionThis = this;

    // This class is only available in GNOME Shell 3.38+.
    if (WindowPreview) {
      this._origDeleteAll = WindowPreview.prototype._deleteAll;

      // The _deleteAll is called when the user clicks the X in the overview.
      WindowPreview.prototype._deleteAll = function() {
        // Do not attempt to close windows twice. Due to the animation in the overview,
        // the close button can be clicked twice which normally would lead to a crash.
        if (!this._closeRequested) {

          // When the user clicks the X in the overview, the window is not deleted
          // immediately. However, as soon as the window is really deleted, we need to
          // adjust the transition of its clone.
          this.metaWindow.connect('unmanaged', () => {
            const transitionConfig = extensionThis._effect.getCloseTransition(
                this.window_container, extensionThis._settings);
            extensionThis._tweakTransitions(this.window_container, transitionConfig);
          });

          // Call the original method.
          extensionThis._origDeleteAll.apply(this);

          // This is required, else WindowPreview's _restack() which is called by the
          // "this.overlayEnabled = false", sometimes tries to access an already delete
          // WindowPreview.
          this._stackAbove    = null;
          this.overlayEnabled = false;
        }
      };
    }

    // On GNOME 3.36, the window clone's 'destroy' handler only calls _removeWindowClone
    // but not _doRemoveWindow. The latter is required to trigger the repositioning of the
    // overview window layout. Therefore we call this method in addition.
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/gnome-3-36/js/ui/workspace.js#L1877
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/workspace.js#L1415
    if (utils.shellVersionIs(3, 36)) {
      Workspace.prototype._addWindowClone = function(...params) {
        const [clone, overlay] = extensionThis._origAddWindowClone.apply(this, params);
        clone.connect('destroy', () => this._doRemoveWindow(clone.metaWindow));
        return [clone, overlay];
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
      // The _destroyWindow method of WindowManager, which was called right before this
      // one, set up the window close animation. This usually fades-out the window and
      // scales it a bit down. If no transition is in progress, something unexpected
      // happened. We rather try not to burn the window!
      const transition = actor.get_transition('scale-y');
      if (!transition) {
        return;
      }

      // We do nothing if a dialog got closed and we should not burn them.
      const isDialogWindow =
          actor.meta_window.window_type == Meta.WindowType.MODAL_DIALOG ||
          actor.meta_window.window_type == Meta.WindowType.DIALOG;

      if (!this._settings.get_boolean('destroy-dialogs') && isDialogWindow) {
        return;
      }

      // Create a list of all currently enabled effects.
      const enabledEffects = ALL_EFFECTS.filter(Effect => {
        return this._settings.get_boolean(`${Effect.getNick()}-close-effect`);
      });

      // Nothing is enabled...
      if (enabledEffects.length == 0) {
        return;
      }

      // Choose a random effect.
      this._effect = enabledEffects[Math.floor(Math.random() * enabledEffects.length)];

      // The effect usually will choose to override the present transitions on the actor.
      const transitionConfig = this._effect.getCloseTransition(actor, this._settings);
      this._tweakTransitions(actor, transitionConfig);

      // Add a cool shader to our window actor!
      const shader = this._effect.createShader(actor, this._settings);

      if (shader) {
        actor.add_effect(shader);

        // Update uniforms at each frame.
        transition.connect('new-frame', (t) => {
          shader.set_uniform_value('uProgress', t.get_progress());
          shader.set_uniform_value('uTime', 0.001 * t.get_elapsed_time());
          shader.set_uniform_value('uSizeX', actor.width);
          shader.set_uniform_value('uSizeY', actor.height);
        });
      }

      // The code below is not necessary for Burn-My-Windows to function. However, there
      // are some extensions such as "Show Application View When Workspace Empty"
      // https://extensions.gnome.org/extension/2036/show-application-view-when-workspace-empty/
      // which do something *after* a window was closed. As the window-close animation
      // duration depends on the used effect, this may vary each time a window is closed.
      // We set the currently used time here, so that others can get an idea how long this
      // will take...
      const duration = transition.get_duration();
      if (isDialogWindow) {
        imports.ui.windowManager.DIALOG_DESTROY_WINDOW_ANIMATION_TIME = duration;
      } else {
        imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME = duration;
      }
    });
  }

  // This function could be called after the extension is uninstalled, disabled in GNOME
  // Tweaks, when you log out or when the screen locks.
  disable() {

    // Unregister our resources.
    Gio.resources_unregister(this._resources);

    // Restore the original behavior.
    global.window_manager.disconnect(this._destroyConnection);

    Workspace.prototype._windowRemoved          = this._origWindowRemoved;
    Workspace.prototype._doRemoveWindow         = this._origDoRemoveWindow;
    Workspace.prototype._addWindowClone         = this._origAddWindowClone;
    WindowManager.prototype._shouldAnimateActor = this._origShouldAnimateActor;

    imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME        = this._origWindowTime;
    imports.ui.windowManager.DIALOG_DESTROY_WINDOW_ANIMATION_TIME = this._origDialogTime;

    if (WindowPreview) {
      WindowPreview.prototype._deleteAll = this._origDeleteAll;
    }

    this._settings = null;
  }

  // ----------------------------------------------------------------------- private stuff

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

  // This is used to tweak the ongoing transitions of a window actor. This is either the
  // actual actor of the Meta.Window or a clone in the overview. Usually windows are faded
  // to transparency and scaled down slightly by GNOME Shell. Here, we allow modifications
  // to this behavior by the effects.
  _tweakTransitions(actor, config) {
    const duration = this._settings.get_int(this._effect.getNick() + '-animation-time');

    for (const property in config) {
      const from = config[property].from;
      const to   = config[property].to;
      const mode = config[property].mode;

      const transition = actor.get_transition(property);

      if (transition) {
        transition.set_duration(duration);

        if (to != undefined) transition.set_to(to);
        if (from != undefined) transition.set_from(from);
        if (mode != undefined) transition.set_progress_mode(mode);

      } else {

        if (from != undefined) actor[property] = from;

        if (to != undefined) {
          actor.save_easing_state();
          actor.set_easing_duration(duration)
          if (mode != undefined) actor.set_easing_mode(mode);
          actor[property] = to;
          actor.restore_easing_state();
        }
      }
    }
  }
}

// This function is called once when the extension is loaded, not enabled.
function init() {
  return new Extension();
}
