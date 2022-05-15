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

    // New effects must be registered here and in prefs.js.
    this._ALL_EFFECTS = [
      new Me.imports.src.Apparition.Apparition(),
      new Me.imports.src.BrokenGlass.BrokenGlass(),
      new Me.imports.src.EnergizeA.EnergizeA(),
      new Me.imports.src.EnergizeB.EnergizeB(),
      new Me.imports.src.Fire.Fire(),
      new Me.imports.src.Hexagon.Hexagon(),
      new Me.imports.src.Matrix.Matrix(),
      new Me.imports.src.SnapOfDisintegration.SnapOfDisintegration(),
      new Me.imports.src.TRexAttack.TRexAttack(),
      new Me.imports.src.TVEffect.TVEffect(),
      new Me.imports.src.Wisps.Wisps(),
    ];

    // Load all of our resources.
    this._resources = Gio.Resource.load(Me.path + '/resources/burn-my-windows.gresource');
    Gio.resources_register(this._resources);

    // Store a reference to the settings object.
    this._settings = ExtensionUtils.getSettings();

    // We will use extensionThis to refer to the extension inside the patched methods.
    const extensionThis = this;

    // We will monkey-patch these methods. Let's store the original ones.
    this._origAddWindowClone        = Workspace.prototype._addWindowClone;
    this._origWindowRemoved         = Workspace.prototype._windowRemoved;
    this._origDoRemoveWindow        = Workspace.prototype._doRemoveWindow;
    this._origShouldAnimateActor    = WindowManager.prototype._shouldAnimateActor;
    this._origWaitForOverviewToHide = WindowManager.prototype._waitForOverviewToHide;
    this._origDestroyWindowDone     = WindowManager.prototype._destroyWindowDone;

    // We will also override these animation times.
    this._origWindowTime = imports.ui.windowManager.DESTROY_WINDOW_ANIMATION_TIME;
    this._origDialogTime = imports.ui.windowManager.DIALOG_DESTROY_WINDOW_ANIMATION_TIME;


    // ------------------------------------------------ patching the window-open animation

    // Here we add an effect to the window-open animation. This is done whenever a new
    // window is created. Usually, there is no real window animation for opening windows
    // in the overview - only the window's clone is animated - but thanks to the hacks
    // below, we can show the real animations in the overview.

    // If a window is created the transitions are set up in the async _mapWindow of the
    // WindowManager:
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1452
    // AFAIK, overriding this method is not possible as it's called by a signal to
    // which it is bound via the bind() method. To tweak the async transition
    // anyways, we override the actors ease() method once - the next time it will be
    // called by the _mapWindow(), we will intercept it!
    this._windowCreatedConnection =
      global.display.connect('window-created', (d, metaWin) => {
        let actor = metaWin.get_compositor_private();

        const orig = actor.ease;
        actor.ease = function(...params) {
          orig.apply(actor, params);
          actor.ease = orig;

          // There are cases where the ease() is called prior to mapping the actor. If
          // the actor is not yet mapped, we defer the effect creation.
          if (actor.mapped) {
            extensionThis._setupEffect(actor, true);
          } else {
            const connectionID = actor.connect('notify::mapped', () => {
              extensionThis._setupEffect(actor, true);
              actor.disconnect(connectionID);
            });
          }
        };
      });

    // Some of the effects require that the window's actor is enlarged to provide a bigger
    // canvas to draw the effects. Outside the overview we can simply increase the scale
    // of the actor. However, if we are in the overview, we have to enlarge the clone of
    // the window as well.
    Workspace.prototype._addWindowClone = function(...params) {
      const result = extensionThis._origAddWindowClone.apply(this, params);

      // The parameters of this method changed a bit through the versions...
      let realWindow, clone;

      if (utils.shellVersionIs(3, 36)) {
        clone      = result[0];
        realWindow = clone.realWindow;
      } else if (utils.shellVersionIs(3, 38)) {
        clone      = result._windowContainer;
        realWindow = params[0].get_compositor_private();
      } else {
        clone      = result.window_container;
        realWindow = params[0].get_compositor_private();
      }

      // Syncing the real window's scale with the scale of its clone only works on GNOME
      // Shell 3.38+. So effects cannot scale windows in the overview of GNOME 3.36...
      if (utils.shellVersionIsAtLeast(3, 38)) {
        const xID = realWindow.connect('notify::scale-x', () => {
          if (realWindow.scale_x > 0 && clone.allocation.get_size()[0] > 0) {
            clone.scale_x = realWindow.scale_x;
          }
        });

        const yID = realWindow.connect('notify::scale-y', () => {
          if (realWindow.scale_y > 0 && clone.allocation.get_size()[1] > 0) {
            clone.scale_y = realWindow.scale_y;
          }
        });

        clone.connect('destroy', () => {
          realWindow.disconnect(xID);
          realWindow.disconnect(yID);
        });
      }

      // This is actually needed for the window-close animation on GNOME Shell 3.36.
      // On GNOME 3.36, the window clone's 'destroy' handler only calls _removeWindowClone
      // but not _doRemoveWindow. The latter is required to trigger the repositioning of
      // the overview window layout. Therefore we call this method in addition.
      // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/gnome-3-36/js/ui/workspace.js#L1877
      // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/workspace.js#L1405
      if (utils.shellVersionIs(3, 36)) {
        clone.connect('destroy', () => this._doRemoveWindow(clone.metaWindow));
      }

      return result;
    };

    // Usually, windows are faded in after the overview is completely hidden. We enable
    // window-open animations by not waiting for this.
    WindowManager.prototype._waitForOverviewToHide = async function() {
      return Promise.resolve();
    };

    // Here comes the ULTRA-HACK: The method below is called (amongst others) by the
    // _destroyWindow and _mapWindow methods of the WindowManager. Usually, it returns
    // false when we are in the overview. This prevents the window animations. As we
    // cannot monkey-patch the _destroyWindow or _mapWindow methods themselves, we check
    // inside the method below whether it was called by either of those. If so, we return
    // true. Let's see if this breaks stuff left and right...
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1124
    WindowManager.prototype._shouldAnimateActor = function(...params) {
      const caller = (new Error()).stack.split('\n')[1];
      if (caller.includes('_destroyWindow@') || caller.includes('_mapWindow@')) {
        return true;
      }
      return extensionThis._origShouldAnimateActor.apply(this, params);
    };


    // ----------------------------------------------- patching the window-close animation

    // The signal handler below and the following patch are all which is required outside
    // of the overview. All other hacks further below are just required to defer the
    // window-hiding in the overview until the effect is finished.

    // The close animation is set up in WindowManager's _destroyWindow:
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1541
    // As we cannot monkey-patch the _destroyWindow itself, we connect to the 'destroy'
    // signal of the window manager and tweak the animation to our needs.
    this._destroyConnection = global.window_manager.connect('destroy', (wm, actor) => {
      this._setupEffect(actor, false);
    });

    // Once the window-close animation is is finished, the window manager's
    // _destroyWindowDone is called. We use this to free the effect so that it can be
    // re-used in future.
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1541
    WindowManager.prototype._destroyWindowDone = function(shellwm, actor) {
      if (this._destroying.has(actor)) {
        const shader = actor.get_effect('burn-my-windows-effect');
        if (shader) {
          actor.remove_effect(shader);
          shader.returnToFactory();
        }
      }

      // Call the original method.
      extensionThis._origDestroyWindowDone.apply(this, [shellwm, actor]);
    };

    // These three method overrides are mega-hacky! Usually, windows are not faded when
    // closed from the overview (why?). With these overrides we make sure that they are
    // actually faded out. To do this, _windowRemoved and _doRemoveWindow now check
    // whether there is a transition ongoing (via extensionThis._shouldDestroy). If that's
    // the case, these methods do nothing. Are the actors removed in the end? I hope so.
    // The _destroyWindow of the WindowManager sets the transitions up and should take
    // care of removing the actors at the end of the transitions.
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/workspace.js#L1301
    Workspace.prototype._windowRemoved = function(ws, metaWin) {
      if (extensionThis._shouldDestroy(this, metaWin)) {
        extensionThis._origWindowRemoved.apply(this, [ws, metaWin]);
      }
    };

    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/workspace.js#L1180
    Workspace.prototype._doRemoveWindow = function(metaWin) {
      if (extensionThis._shouldDestroy(this, metaWin)) {
        extensionThis._origDoRemoveWindow.apply(this, [metaWin]);
      }
    };

    // With the code below, we hide the window-overlay (icon, label, close button) in the
    // overview once the close-animation is running. As the WindowPreview class is only
    // available on GNOME 3.38 and beyond, we cannot hide the overlay on GNOME 3.36.
    if (WindowPreview) {

      // We will monkey-patch these methods.
      this._origDeleteAll = WindowPreview.prototype._deleteAll;
      this._origRestack   = WindowPreview.prototype._restack;
      this._origInit      = WindowPreview.prototype._init;

      // Whenever a WindowPreview is created, we connect to the referenced Meta.Window's
      // 'unmanaged' signal to hide the overlay.
      WindowPreview.prototype._init = function(...params) {
        extensionThis._origInit.apply(this, params);

        // Hide the window's icon, name, and close button.
        const connectionID = this.metaWindow.connect('unmanaged', () => {
          if (this.window_container) {
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

      // This is required, else WindowPreview's _restack() which is called by the
      // "this.overlayEnabled = false", sometimes tries to access an already delete
      // WindowPreview.
      WindowPreview.prototype._restack = function() {
        if (!this._closeRequested) {
          extensionThis._origRestack.apply(this);
        }
      };
    }
  }

  // This function could be called after the extension is uninstalled, disabled in GNOME
  // Tweaks, when you log out or when the screen locks.
  disable() {

    // Free all effect resources.
    this._ALL_EFFECTS = [];

    // Unregister our resources.
    Gio.resources_unregister(this._resources);

    // Restore the original window-open and window-close animations.
    global.window_manager.disconnect(this._destroyConnection);
    global.display.disconnect(this._windowCreatedConnection);

    Workspace.prototype._addWindowClone            = this._origAddWindowClone;
    Workspace.prototype._windowRemoved             = this._origWindowRemoved;
    Workspace.prototype._doRemoveWindow            = this._origDoRemoveWindow;
    WindowManager.prototype._shouldAnimateActor    = this._origShouldAnimateActor;
    WindowManager.prototype._waitForOverviewToHide = this._origWaitForOverviewToHide;
    WindowManager.prototype._destroyWindowDone     = this._origDestroyWindowDone;

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

  // This method adds one of the configured effects to the given actor. If forOpening is
  // set to true, a effect from the enabled window-open animations is chosen, else an
  // enabled window-close animation is used. This will also tweak the transitions of the
  // given actor (e.g. scale it up if required).
  _setupEffect(actor, forOpening) {

    // Only add effects to normal windows and dialog windows.
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

    // There is the weird case where an animation is already ongoing. This happens when a
    // window is closed which has been created before the session was started (e.g. when
    // GNOME Shell has been restarted in the meantime).
    const oldShader = actor.get_effect('burn-my-windows-effect');
    if (oldShader) {
      actor.remove_effect(oldShader);
      oldShader.returnToFactory();
    }

    // ------------------------------------------------------------------ choose an effect

    // Now we chose a random effect from all enabled effects.
    let effect = null;

    // First we check if an effect is to be previewed.
    if (previewNick != '') {
      effect = this._ALL_EFFECTS.find(effect => effect.getNick() == previewNick);

      // Only preview the effect once.
      this._settings.set_string(action + '-preview-effect', '');

    }
    // Else we choose a random effect from all enabled effects.
    else {

      // Therefore, we first create a list of all currently enabled effects.
      const enabled = this._ALL_EFFECTS.filter(effect => {
        return this._settings.get_boolean(`${effect.getNick()}-${action}-effect`);
      });

      // And then choose a random effect.
      if (enabled.length > 0) {
        effect = enabled[Math.floor(Math.random() * enabled.length)];
      }
    }

    // If nothing was enabled, we have to do nothing :)
    if (effect == null) {
      this._fixAnimationTimes(isDialogWindow, forOpening, null);
      return;
    }

    // ----------------------------------------------------------- tweak actor transitions

    // If we are currently performing integration test, all animations are set to a fixed
    // duration and show a fixed frame from the middle of the animation.
    const testMode = this._settings.get_boolean('test-mode');

    // The following is used to tweak the ongoing transitions of a window actor. Usually
    // windows are faded in / out scaled up / down slightly by GNOME Shell. Here, we tweak
    // the transitions so that nothing changes. The window stays opaque and is scaled to
    // actorScale.
    const actorScale = effect.getActorScale(this._settings);

    // To make things deterministic during testing, we set the effect duration to 5
    // seconds.
    const duration =
      testMode ? 5000 : this._settings.get_int(effect.getNick() + '-animation-time');

    // All animations are relative to the window's center.
    actor.set_pivot_point(0.5, 0.5);


    // We tweak the opacity and scale of the actor. If there is no ongoing transition for
    // a property, a new one is set up.
    const config = {'opacity': 255, 'scale-x': actorScale.x, 'scale-y': actorScale.y};

    for (const property in config) {
      let transition = actor.get_transition(property);

      // If there is currently no ongoing transition, we create a new one. Clutter does
      // not like to create transitions with the same start and end value - however, we
      // need at least one transition for our progress value in the shader. So we trick
      // Clutter by creating an arbitrary transition first and then modifying the start
      // and end values according to our config object.
      if (!transition) {
        actor.set_property(property, 0);
        actor.save_easing_state();
        actor.set_easing_duration(1000);
        actor.set_property(property, 1);
        actor.restore_easing_state();

        // Now there should be a transition!
        transition = actor.get_transition(property);
      }

      // Tweak the transition according to the config object. For some reason, there are
      // rare cases, where no transition is set up. This happens from time to time...
      if (transition) {
        transition.set_duration(duration);
        transition.set_to(config[property]);
        transition.set_from(config[property]);
        transition.set_progress_mode(Clutter.AnimationMode.LINEAR);
      }
    }

    // Once the transitions are finished, we restore the original actor size.
    if (forOpening) {
      const connectionID = actor.connect('transitions-completed', () => {
        actor.scale_x = 1.0;
        actor.scale_y = 1.0;
        actor.disconnect(connectionID);
      });
    }


    // -------------------------------------------------------------------- add the shader

    // Now add a cool shader to our window actor!
    const shader = effect.shaderFactory.getShader();

    // There should always be an opacity transition going on...
    const transition = actor.get_transition('opacity');

    if (!transition) {
      this._fixAnimationTimes(isDialogWindow, forOpening, null);
      utils.debug('Cannot setup shader without opacity transition.')
      return;
    }

    // Assign the effect to the window actor!
    actor.add_effect_with_name('burn-my-windows-effect', shader);

    // Set one-time uniforms.
    shader.beginAnimation(this._settings, forOpening, actor);

    // Set other uniforms each frame.
    transition.connect('new-frame', (t) => {
      if (testMode) {
        shader.updateAnimation(0.5, 0.001 * duration * 0.5);
      } else {
        shader.updateAnimation(t.get_progress(), 0.001 * t.get_elapsed_time());
      }
    });

    // Remove the effect if the animation finished or was interrupted.
    if (forOpening) {
      transition.connect('stopped', () => {
        const oldShader = actor.get_effect('burn-my-windows-effect');
        if (oldShader) {
          actor.remove_effect(oldShader);
          oldShader.returnToFactory();
        }
      });
    }

    // Finally, ensure that all animation times are set properly so that other extensions
    // may guess how long it will take until windows are gone :)
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
