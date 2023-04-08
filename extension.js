//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

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
const migrate        = Me.imports.src.migrate;
const utils          = Me.imports.src.utils;
const ProfileManager = Me.imports.src.ProfileManager.ProfileManager;
const WindowPicker   = Me.imports.src.WindowPicker.WindowPicker;

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
      new Me.imports.src.effects.Apparition.Apparition(),
      new Me.imports.src.effects.BrokenGlass.BrokenGlass(),
      new Me.imports.src.effects.Doom.Doom(),
      new Me.imports.src.effects.EnergizeA.EnergizeA(),
      new Me.imports.src.effects.EnergizeB.EnergizeB(),
      new Me.imports.src.effects.Fire.Fire(),
      new Me.imports.src.effects.Glide.Glide(),
      new Me.imports.src.effects.Glitch.Glitch(),
      new Me.imports.src.effects.Hexagon.Hexagon(),
      new Me.imports.src.effects.Incinerate.Incinerate(),
      new Me.imports.src.effects.Matrix.Matrix(),
      new Me.imports.src.effects.Pixelate.Pixelate(),
      new Me.imports.src.effects.PixelWheel.PixelWheel(),
      new Me.imports.src.effects.PixelWipe.PixelWipe(),
      new Me.imports.src.effects.Portal.Portal(),
      new Me.imports.src.effects.SnapOfDisintegration.SnapOfDisintegration(),
      new Me.imports.src.effects.TRexAttack.TRexAttack(),
      new Me.imports.src.effects.TVEffect.TVEffect(),
      new Me.imports.src.effects.TVGlitch.TVGlitch(),
      new Me.imports.src.effects.Wisps.Wisps(),
    ];

    // Load all of our resources.
    this._resources = Gio.Resource.load(Me.path + '/resources/burn-my-windows.gresource');
    Gio.resources_register(this._resources);

    // Store a reference to the settings object.
    this._settings = ExtensionUtils.getSettings();

    // Now we check whether the extension settings need to be migrated from a previous
    // version. If this is the case, we defer the profile loading until this is finished.
    const lastVersion = this._settings.get_int('last-extension-version');
    if (lastVersion < Me.metadata.version) {
      if (lastVersion <= 26) {
        // If the profile migration fails for some reason, the callback will create a
        // default profile instead.
        migrate.fromVersion26().finally(() => {
          this._loadProfiles();
          this._settings.set_int('last-extension-version', Me.metadata.version);
        });
      } else {
        this._loadProfiles();
      }

    } else {
      this._loadProfiles();
    }

    // We reload all effect profiles whenever the currently edited profile in the
    // preferences dialog changes. This is most likely a bit too often, but it will also
    // happen whenever a new profile is created and whenever an old profile is deleted.
    this._settings.connect('changed::active-profile', () => {
      this._loadProfiles();
    });

    // This is used to get the desktop's color scheme.
    this._shellSettings = new Gio.Settings({schema: 'org.gnome.desktop.interface'});

    // Enable the window-picking D-Bus API for the preferences dialog.
    this._windowPicker = new WindowPicker();
    this._windowPicker.export();

    // We will use extensionThis to refer to the extension inside the patched methods.
    const extensionThis = this;

    // This is used to get the battery state.
    const UPowerProxy = Gio.DBusProxy.makeProxyWrapper(
      utils.getStringResource('/interfaces/org.freedesktop.UPower.xml'));
    this._upowerProxy = new UPowerProxy(Gio.DBus.system, 'org.freedesktop.UPower',
                                        '/org/freedesktop/UPower');

    // This is used to get the current power profile.
    try {
      const PowerProfilesProxy = Gio.DBusProxy.makeProxyWrapper(
        utils.getStringResource('/interfaces/net.hadess.PowerProfiles.xml'));
      this._powerProfilesProxy = new PowerProfilesProxy(
        Gio.DBus.system, 'net.hadess.PowerProfiles', '/net/hadess/PowerProfiles');
    } catch (e) {
      // Maybe the service is masked...
    }

    // We will monkey-patch these methods. Let's store the original ones.
    this._origShouldAnimateActor    = Main.wm._shouldAnimateActor;
    this._origWaitForOverviewToHide = Main.wm._waitForOverviewToHide;
    this._origAddWindowClone        = Workspace.prototype._addWindowClone;
    this._origWindowRemoved         = Workspace.prototype._windowRemoved;
    this._origDoRemoveWindow        = Workspace.prototype._doRemoveWindow;

    // ------------------------------- patching the window animations outside the overview

    // If a window is created, the transitions are set up in the async _mapWindow() of the
    // WindowManager:
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1487
    // AFAIK, overriding this method is not possible as it's called by a signal to which
    // it is bound via the bind() method. To tweak the async transition anyways, we
    // override the actors ease() method once. We do this in _shouldAnimateActor() which
    // is called right before the ease() in _mapWindow:
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1472

    // The same trick is done for the window-close animation. This is set up in a similar
    // fashion in the WindowManager's _destroyWindow():
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1558.
    // Here is _shouldAnimateActor() also called right before. So we use it again to
    // monkey-patch the window actor's ease() once.

    // We override WindowManager._shouldAnimateActor() also for another purpose: Usually,
    // it returns false when we are in the overview. This prevents the window animations
    // there. To enable animations in the overview, we check inside the method whether it
    // was called by either _mapWindow or _destroyWindow. If so, we return true. Let's see
    // if this breaks stuff left and right...
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1120
    Main.wm._shouldAnimateActor = function(actor, types) {
      const stack      = (new Error()).stack;
      const forClosing = stack.includes('_destroyWindow@');
      const forOpening = stack.includes('_mapWindow@');

      // This is also called in other cases, for instance when minimizing windows. We are
      // only interested in window opening and window closing for now.
      if (forClosing || forOpening) {

        // If there is an applicable effect profile, we intercept the ease() method to
        // setup our own effect.
        const chosenEffect = extensionThis._chooseEffect(actor, forOpening);

        if (chosenEffect) {
          // Store the original ease() method of the actor.
          const orig = actor.ease;

          // Now intercept the next call to actor.ease().
          actor.ease = function(...params) {
            // Quickly restore the original behavior. Nobody noticed, I guess :D
            actor.ease = orig;

            // And then create the effect!
            extensionThis._setupEffect(actor, forOpening, chosenEffect.effect,
                                       chosenEffect.profile);
          };

          return true;
        }
      }

      return extensionThis._origShouldAnimateActor.apply(this, [actor, types]);
    };

    // Make sure to remove any effects if requested by the window manager.
    this._killEffectsSignal =
      global.window_manager.connect('kill-window-effects', (wm, actor) => {
        const shader = actor.get_effect('burn-my-windows-effect');
        if (shader) {
          shader.endAnimation();
        }
      });


    // --------------------------------------------- fix window animations in the overview

    // Some of the effects require that the window's actor is enlarged to provide a bigger
    // canvas to draw the effects. Outside the overview we can simply increase the scale
    // of the actor. However, if we are in the overview, we have to enlarge the clone of
    // the window as well.
    Workspace.prototype._addWindowClone = function(...params) {
      const clone = extensionThis._origAddWindowClone.apply(this, params);

      // The parameters of this method changed a bit through the versions...
      let realWindow, container;

      if (utils.shellVersionIs(3, 36)) {
        container  = clone[0];
        realWindow = container.realWindow;
      } else if (utils.shellVersionIs(3, 38)) {
        container  = clone._windowContainer;
        realWindow = params[0].get_compositor_private();
      } else {
        container  = clone.window_container;
        realWindow = params[0].get_compositor_private();
      }

      // Store the overview clone as temporary members of the real window actor. When we
      // set up the effect, we will check for the existence of these and enlarge the clone
      // as needed.
      realWindow._bmwOverviewClone          = clone;
      realWindow._bmwOverviewCloneContainer = container;

      // Remove the temporary members again once the clone is deleted.
      container.connect('destroy', () => {
        delete realWindow._bmwOverviewClone;
        delete realWindow._bmwOverviewCloneContainer;
      });

      // This is actually needed for the window-close animation on GNOME Shell 3.36.
      // On GNOME 3.36, the window clone's 'destroy' handler only calls _removeWindowClone
      // but not _doRemoveWindow. The latter is required to trigger the repositioning of
      // the overview window layout. Therefore we call this method in addition.
      // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/gnome-3-36/js/ui/workspace.js#L1877
      // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/workspace.js#L1363
      if (utils.shellVersionIs(3, 36)) {
        container.connect('destroy', () => this._doRemoveWindow(container.metaWindow));
      }

      return clone;
    };

    // Usually, windows are faded in after the overview is completely hidden. We enable
    // window-open animations by not waiting for this.
    Main.wm._waitForOverviewToHide = async function() {
      return Promise.resolve();
    };

    // These three method overrides are mega-hacky! Usually, windows are not faded when
    // closed from the overview (why?). With these overrides we make sure that they are
    // actually faded out. To do this, _windowRemoved and _doRemoveWindow now check
    // whether there is a transition ongoing (via extensionThis._shouldDestroy). If that's
    // the case, these methods do nothing.
    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/workspace.js#L1258
    Workspace.prototype._windowRemoved = function(ws, metaWin) {
      if (extensionThis._shouldDestroy(this, metaWin)) {
        extensionThis._origWindowRemoved.apply(this, [ws, metaWin]);
      }
    };

    // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/workspace.js#L1137
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

    // Disable the window-picking D-Bus API.
    this._windowPicker.unexport();

    global.window_manager.disconnect(this._killEffectsSignal);

    // Restore the original window-open and window-close animations.
    Workspace.prototype._addWindowClone = this._origAddWindowClone;
    Workspace.prototype._windowRemoved  = this._origWindowRemoved;
    Workspace.prototype._doRemoveWindow = this._origDoRemoveWindow;
    Main.wm._shouldAnimateActor         = this._origShouldAnimateActor;
    Main.wm._waitForOverviewToHide      = this._origWaitForOverviewToHide;

    if (WindowPreview) {
      WindowPreview.prototype._deleteAll = this._origDeleteAll;
      WindowPreview.prototype._restack   = this._origRestack;
      WindowPreview.prototype._init      = this._origInit;
    }

    this._settings = null;
  }

  // ----------------------------------------------------------------------- private stuff

  // This loads all effect profiles and assigns a priority to each profile. Whenever a
  // window is opened or closed, the matching effect profile with the highest priority
  // will be chosen.
  // This method is called whenever the currently edited profile in the/ preferences
  // dialog changes. This is most likely a bit too often, but it will also happen whenever
  // a new profile is created and whenever an old profile is deleted.
  _loadProfiles() {

    // Get all currently available profiles.
    const profileManager = new ProfileManager();
    this._profiles       = profileManager.getProfiles();

    // Whenever the properties of a profile is changed in the settings, we may have to
    // resort all profiles according to their priority.
    const updatePriority = (p) => {
      p.priority = profileManager.getProfilePriority(p.settings);
      this._profiles.sort((a, b) => b.priority - a.priority);
    };

    // For each profile, assign an initial priority and update the priority whenever a
    // related setting changes.
    this._profiles.forEach(p => {
      p.priority = profileManager.getProfilePriority(p.settings);
      p.settings.connect('changed::profile-app', () => updatePriority(p));
      p.settings.connect('changed::profile-animation-type', () => updatePriority(p));
      p.settings.connect('changed::profile-window-type', () => updatePriority(p));
      p.settings.connect('changed::profile-color-scheme', () => updatePriority(p));
      p.settings.connect('changed::profile-power-mode', () => updatePriority(p));
      p.settings.connect('changed::profile-power-profile', () => updatePriority(p));
      p.settings.connect('changed::profile-high-priority', () => updatePriority(p));
    });

    // Sort all profiles initially according to their initial priority.
    this._profiles.sort((a, b) => b.priority - a.priority);
  }

  // This method selects an effect profile matching the current circumstances. Then a
  // random effect from its enabled effects will be selected. It returns null if no
  // profile is currently applicable.
  _chooseEffect(actor, forOpening) {

    // For now, we only add effects to normal windows and dialog windows.
    const isNormalWindow = actor.meta_window.window_type == Meta.WindowType.NORMAL;
    const isDialogWindow =
      actor.meta_window.window_type == Meta.WindowType.MODAL_DIALOG ||
      actor.meta_window.window_type == Meta.WindowType.DIALOG;

    if (!isNormalWindow && !isDialogWindow) {
      return null;
    }

    // ----------------------------------------------- choose a profile and then an effect

    // Usually, we use the effect profile with the highest priority which matches the
    // current circumstances. From this profile, we choose a random effect. However, if an
    // effect is to be previewed, we choose the currently edited profile regardless of the
    // circumstances.
    let profile = null;
    let effect  = null;

    // Hence, we first check if an effect is to be previewed.
    const previewNick = this._settings.get_string('preview-effect');

    if (previewNick != '') {
      const activeProfile = this._settings.get_string('active-profile');
      effect  = this._ALL_EFFECTS.find(effect => effect.getNick() == previewNick);
      profile = this._profiles.find(p => p.path == activeProfile);

      // Only preview the effect until the preview window is closed.
      if (!profile || !forOpening) {
        this._settings.set_string('preview-effect', '');
      }
    }
    // If no effect is previewed, we use the effect profile with the highest priority
    // which matches the current circumstances. From this profile, we choose a random
    // effect.
    else {

      // These numbers match the indices in the Gtk.StringLists defined in the UI files
      // (e.g. resources/ui/adw/prefs.ui).
      const animationType = forOpening ? 1 : 2;
      const windowType    = isNormalWindow ? 1 : 2;
      const powerMode     = this._upowerProxy.OnBattery ? 1 : 2;

      // Get the first profile whose constraints match the circumstances. The list is
      // sorted by priority, so we are good to take the first match.
      profile = this._profiles.find(p => {
        const profileApp           = p.settings.get_string('profile-app');
        const profileAnimationType = p.settings.get_int('profile-animation-type');
        const profileWindowType    = p.settings.get_int('profile-window-type');
        const profilePowerMode     = p.settings.get_int('profile-power-mode');
        const profileColorScheme   = p.settings.get_int('profile-color-scheme');
        const profilePowerProfile  = p.settings.get_int('profile-power-profile');

        // First we check whether the animation type, window type, and power mode are
        // matching.
        let matches =
          (profileAnimationType == 0 || profileAnimationType == animationType) &&
          (profileWindowType == 0 || profileWindowType == windowType) &&
          (profilePowerMode == 0 || profilePowerMode == powerMode);

        // If that was the case, we also check the application name.
        if (matches && profileApp != '') {
          const app = actor.meta_window.get_wm_class().toLowerCase();

          // Split app names at |, remove any whitespace, and transform to lower case.
          const profileApps =
            profileApp.split('|').map(item => item.trim().toLowerCase());
          matches = profileApps.includes(app);
        }

        // If the profile is still matching, we also check the color scheme.
        if (matches && profileColorScheme != 0 && utils.shellVersionIsAtLeast(42, 0)) {
          const colorScheme = this._shellSettings.get_string('color-scheme');
          matches &= (profileColorScheme == 1 && colorScheme == 'default') ||
            (profileColorScheme == 2 && colorScheme == 'prefer-dark');
        }

        // Finally, we may also have to check the power profile.
        if (matches && profilePowerProfile != 0 && this._powerProfilesProxy) {
          const powerProfile = this._powerProfilesProxy.ActiveProfile;

          // To understand the numbers, please refer to the indices in the Gtk.StringList
          // of the profile-power-profile Adw.ComboRow in resources/ui/adw/prefs.ui.
          if (powerProfile == 'power-saver') {
            matches &= profilePowerProfile == 1 || profilePowerProfile == 4;
          } else if (powerProfile == 'balanced') {
            matches &= profilePowerProfile == 2 || profilePowerProfile == 4 ||
              profilePowerProfile == 5;
          } else {
            matches &= profilePowerProfile == 3 || profilePowerProfile == 5;
          }
        }

        return matches;
      });

      // If we found a matching profile, choose a random effect from it.
      if (profile) {

        // Create a list of all enabled effects of this profile.
        const enabled = this._ALL_EFFECTS.filter(effect => {
          return profile.settings.get_boolean(`${effect.getNick()}-enable-effect`);
        });

        // And then choose a random effect.
        if (enabled.length > 0) {
          effect = enabled[Math.floor(Math.random() * enabled.length)];
        }
      }
    }

    // If nothing was enabled, we have to do nothing :)
    if (!effect || !profile) {
      return null;
    }

    return {effect: effect, profile: profile};
  }

  // This method adds the given effect using the settings from the given profile to the
  // given actor.
  _setupEffect(actor, forOpening, effect, profile) {

    // There is the weird case where an animation is already ongoing. This happens when a
    // window is closed which has been created before the session was started (e.g. when
    // GNOME Shell has been restarted in the meantime).
    const oldShader = actor.get_effect('burn-my-windows-effect');
    if (oldShader) {
      oldShader.endAnimation();
    }

    // If we are currently performing integration test, all animations are set to a fixed
    // duration and show a fixed frame from the middle of the animation.
    const testMode = this._settings.get_boolean('test-mode');

    // The following is used to tweak the ongoing transitions of a window actor. Usually
    // windows are faded in / out scaled up / down slightly by GNOME Shell. Here, we tweak
    // the transitions so that nothing changes. The window stays opaque and is scaled to
    // actorScale.
    const actorScale = effect.getActorScale(profile.settings, forOpening, actor);

    // All scaling is relative to the window's center.
    actor.set_pivot_point(0.5, 0.5);
    actor.opacity = 255;
    actor.scale_x = actorScale.x;
    actor.scale_y = actorScale.y;

    // If we are in the overview, we have to enlarge the window's clone as well. We also
    // disable the clone's overlay (e.g. its icon, name, and close button) during the
    // animation.
    if (actor._bmwOverviewClone && utils.shellVersionIsAtLeast(3, 38)) {
      actor._bmwOverviewClone.overlayEnabled = false;
      actor._bmwOverviewCloneContainer.set_pivot_point(0.5, 0.5);
      actor._bmwOverviewCloneContainer.scale_x = actorScale.x;
      actor._bmwOverviewCloneContainer.scale_y = actorScale.y;
    }

    // Now add a cool shader to our window actor!
    const shader = effect.shaderFactory.getShader();
    actor.add_effect_with_name('burn-my-windows-effect', shader);

    // At the end of the animation, we restore the scale of the overview clone (if any)
    // and call the methods which would have been called by the original ease() calls at
    // the end of the standard fade-in animation.
    const endID = shader.connect('end-animation', () => {
      shader.disconnect(endID);

      if (actor._bmwOverviewClone && utils.shellVersionIsAtLeast(3, 38)) {
        actor._bmwOverviewClone.overlayEnabled   = true;
        actor._bmwOverviewCloneContainer.scale_x = 1.0;
        actor._bmwOverviewCloneContainer.scale_y = 1.0;
      }

      // Remove the shader and mark it being re-usable for future animations.
      actor.remove_effect(shader);
      shader.returnToFactory();

      // Finally, once the animation is done or interrupted, we call the methods which
      // should have been called by the original ease() methods.
      // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1487
      // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/windowManager.js#L1558.
      if (forOpening) {
        Main.wm._mapWindowDone(global.window_manager, actor);
      } else {
        Main.wm._destroyWindowDone(global.window_manager, actor);
      }
    });

    // To make things deterministic during testing, we set the effect duration to 5
    // seconds.
    const duration =
      testMode ? 5000 : profile.settings.get_int(effect.getNick() + '-animation-time');

    // Finally start the animation!
    shader.beginAnimation(profile.settings, forOpening, testMode, duration, actor);
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
    const shader       = actor.get_effect('burn-my-windows-effect');

    return shader == null;
  }
}

// This function is called once when the extension is loaded, not enabled.
function init() {
  return new Extension();
}
