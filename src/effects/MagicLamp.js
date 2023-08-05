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

const {GObject, Graphene} = imports.gi;

const _ = imports.gettext.domain('burn-my-windows').gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;
const ShaderFactory  = Me.imports.src.ShaderFactory.ShaderFactory;

//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
var MagicLamp = class {

  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.
  constructor() {
    this.shaderFactory = new ShaderFactory(this.getNick(), (shader) => {
      // Store uniform locations of newly created shaders.
      shader._uActorScale        = shader.get_uniform_location('uActorScale');
      shader._uInitialPointerPos = shader.get_uniform_location('uInitialPointerPos');
      shader._uCurrentPointerPos = shader.get_uniform_location('uCurrentPointerPos');
      shader._uControlPointA     = shader.get_uniform_location('uControlPointA');
      shader._uControlPointB     = shader.get_uniform_location('uControlPointB');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation',
                     (shader, settings, forOpening, testMode, actor) => {
                       this._initialPointerPos = null;
                       this._controlPointA     = null;
                       this._controlPointB     = null;

                       shader.set_uniform_float(shader._uActorScale, 2, [
                         2.0 * Math.max(1.0, global.stage.width / actor.width),
                         2.0 * Math.max(1.0, global.stage.height / actor.height)
                       ]);

                       this._actor = actor;
                     });

      shader.connect('update-animation', (shader) => {
        const convertCoords = coords => {
          const [ok, localX, localY] =
            this._actor.transform_stage_point(coords[0], coords[1]);

          const scale = [
            2.0 * Math.max(1.0, global.stage.width / this._actor.width),
            2.0 * Math.max(1.0, global.stage.height / this._actor.height)
          ];

          return [
            ok,
            localX / this._actor.width * scale[0] + 0.5 - scale[0] * 0.5,
            localY / this._actor.height * scale[1] + 0.5 - scale[1] * 0.5,
          ];
        };

        const pointer = global.get_pointer();

        {
          const [ok, x, y] = convertCoords(pointer);

          if (ok) {
            if (!this._initialPointerPos) {
              this._initialPointerPos = [x, y];
              shader.set_uniform_float(shader._uInitialPointerPos, 2, [x, y]);
            }

            shader.set_uniform_float(shader._uCurrentPointerPos, 2, [x, y]);
          }
        }

        {
          const center = this._actor.apply_transform_to_point(new Graphene.Point3D(
            {x: this._actor.width / 2, y: this._actor.height / 2, z: 0}));
          const controlPointA =
            [pointer[0] * 0.33 + 0.66 * center.x, pointer[1] * 0.33 + 0.66 * center.y];

          if (!this._controlPointA) {
            this._controlPointA = controlPointA;
          } else {
            this._controlPointA = [
              this._controlPointA[0] * 0.99 + controlPointA[0] * 0.01,
              this._controlPointA[1] * 0.99 + controlPointA[1] * 0.01
            ];
          }

          const [ok, x, y] = convertCoords(this._controlPointA);

          shader.set_uniform_float(shader._uControlPointA, 2, [x, y]);
        }

        {
          const center = this._actor.apply_transform_to_point(new Graphene.Point3D(
            {x: this._actor.width / 2, y: this._actor.height / 2, z: 0}));
          const controlPointB =
            [pointer[0] * 0.66 + 0.33 * center.x, pointer[1] * 0.66 + 0.33 * center.y];

          if (!this._controlPointB) {
            this._controlPointB = controlPointB;
          } else {
            this._controlPointB = [
              this._controlPointB[0] * 0.95 + controlPointB[0] * 0.05,
              this._controlPointB[1] * 0.95 + controlPointB[1] * 0.05
            ];
          }

          const [ok, x, y] = convertCoords(this._controlPointB);

          shader.set_uniform_float(shader._uControlPointB, 2, [x, y]);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------- metadata

  // The effect is not available on GNOME Shell 3.36 as it requires scaling of the window
  // actor.
  getMinShellVersion() {
    return [3, 38];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-enable-effect'), and its animation time
  // (e.g. '*-animation-time').
  getNick() {
    return 'magic-lamp';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  getLabel() {
    return _('Magic Lamp');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  bindPreferences(dialog) {
    dialog.bindAdjustment('magic-lamp-animation-time');
    // dialog.bindAdjustment('doom-horizontal-scale');
    // dialog.bindAdjustment('doom-vertical-scale');
    // dialog.bindAdjustment('doom-pixel-size');
  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  // For this effect, we scale the actor vertically so that it covers the entire screen.
  // This ensures that the melted window will not be cut off.
  getActorScale(settings, forOpening, actor) {
    // return {x: 1.0, y: 1.0};
    return {
      x: 2.0 * Math.max(1.0, global.stage.width / actor.width),
      y: 2.0 * Math.max(1.0, global.stage.height / actor.height)
    };
  }
}
