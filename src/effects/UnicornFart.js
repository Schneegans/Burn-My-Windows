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

// SPDX-FileCopyrightText: Justin Garza JGarza9788@gmail.com
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

// Import the Gio module from the GNOME platform (GObject Introspection).
// This module provides APIs for I/O operations, settings management, and other core
// features.
import Gio from 'gi://Gio';

// Import utility functions from the local utils.js file.
// These utilities likely contain helper functions or shared logic used across the
// application.
import * as utils from '../utils.js';

// We import the ShaderFactory only in the Shell process as it is not required in the
// preferences process. The preferences process does not create any shader instances, it
// only uses the static metadata of the effect.
const ShaderFactory = await utils.importInShellOnly('./ShaderFactory.js');

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// I thought to myself, i said "self what would a unicorn fart look like" and then i came up with this, and i don't care that i'm out of the box, i think outside of the box, yeah f*ck that box!
//////////////////////////////////////////////////////////////////////////////////////////

// The effect class can be used to get some metadata (like the effect's name or supported
// GNOME Shell versions), to initialize the respective page of the settings dialog, as
// well as to create the actual shader for the effect.
export default class Effect {
  // The constructor creates a ShaderFactory which will be used by extension.js to create
  // shader instances for this effect. The shaders will be automagically created using the
  // GLSL file in resources/shaders/<nick>.glsl. The callback will be called for each
  // newly created shader instance.
  constructor() {
    this.shaderFactory = new ShaderFactory(Effect.getNick(), (shader) => {
      // Store uniform locations of newly created shaders.

      shader._uParticles = shader.get_uniform_location('uParticles');
      shader._uParticleSize = shader.get_uniform_location('uParticleSize');
      shader._uParticleSpeed = shader.get_uniform_location('uParticleSpeed');
      shader._uParticleColorRandom = shader.get_uniform_location('uParticleColorRandom');
      shader._uParticleColorSpeed = shader.get_uniform_location('uParticleColorSpeed');

      shader._uSparkCount = shader.get_uniform_location('uSparkCount');
      shader._uSparkStartEnd = shader.get_uniform_location('uSparkStartEnd');
      shader._uSparkOffset = shader.get_uniform_location('uSparkOffset');
      shader._uSparkCount = shader.get_uniform_location('uSparkCount');

      shader._uStarCount = shader.get_uniform_location('uStarCount');
      shader._uStarRot = shader.get_uniform_location('uStarRot');
      shader._uStarSize = shader.get_uniform_location('uStarSize');
      shader._uStarStartEnd = shader.get_uniform_location('uStarStartEnd');

      shader._uBlurQuality = shader.get_uniform_location('uBlurQuality');
      shader._uSeed = shader.get_uniform_location('uSeed');

      shader._uStarColors = [
        shader.get_uniform_location('uStarColor0'),
        shader.get_uniform_location('uStarColor1'),
        shader.get_uniform_location('uStarColor2'),
        shader.get_uniform_location('uStarColor3'),
        shader.get_uniform_location('uStarColor4'),
        shader.get_uniform_location('uStarColor5'),
      ];

      shader._uParticleColors = [
        shader.get_uniform_location('uParticlesColor0'),
        shader.get_uniform_location('uParticlesColor1'),
        shader.get_uniform_location('uParticlesColor2'),
        shader.get_uniform_location('uParticlesColor3'),
        shader.get_uniform_location('uParticlesColor4'),
        shader.get_uniform_location('uParticlesColor5'),
      ];


      //   shader._uFadeWidth = shader.get_uniform_location('uFadeWidth');

      // Write all uniform values at the start of each animation.
      shader.connect('begin-animation',
                     (shader, settings) => {

                      for (let i = 0; i <= 5; i++) {
                        shader.set_uniform_float(
                          shader._uStarColors[i], 4,
                          utils.parseColor(settings.get_string('unicorn-fart-star-color-' + i)));
                      }

                      for (let i = 0; i <= 5; i++) {
                        shader.set_uniform_float(
                          shader._uParticleColors[i], 4,
                          utils.parseColor(settings.get_string('unicorn-fart-particle-color-' + i)));
                      }

                      shader.set_uniform_float(shader._uParticles, 1,
                        [settings.get_boolean('unicorn-fart-particles-enable')]);

                      shader.set_uniform_float(shader._uParticleSize, 1, 
                        [settings.get_double('unicorn-fart-particle-size')]);

                      shader.set_uniform_float(shader._uParticleSpeed, 1, 
                        [settings.get_double('unicorn-fart-particle-speed')]);

                      shader.set_uniform_float(shader._uParticleColorRandom, 1, 
                        [settings.get_double('unicorn-fart-particle-color-random')]);

                      shader.set_uniform_float(shader._uParticleColorSpeed, 1, 
                        [settings.get_double('unicorn-fart-particle-color-speed')]);

                      shader.set_uniform_float(shader._uSparkCount,  1, 
                        [settings.get_int('unicorn-fart-spark-count')]);

                      shader.set_uniform_float(shader._uSparkStartEnd,  2, 
                        [settings.get_double('unicorn-fart-spark-start'), 
                          settings.get_double('unicorn-fart-spark-end')]
                        );

                      shader.set_uniform_float(shader._uSparkOffset, 1, 
                        [settings.get_double('unicorn-fart-spark-offset')]);

                      shader.set_uniform_float(shader._uStarCount,  1, 
                        [settings.get_int('unicorn-fart-star-count')]);

                      shader.set_uniform_float(shader._uStarRot, 1, 
                        [settings.get_double('unicorn-fart-star-rotation')]);

                      shader.set_uniform_float(shader._uStarSize, 1, 
                        [settings.get_double('unicorn-fart-star-size')]);

                      shader.set_uniform_float(shader._uStarStartEnd,  2, 
                        [settings.get_double('unicorn-fart-star-start'), 
                          settings.get_double('unicorn-fart-star-end')]
                        );

                      shader.set_uniform_float(shader._uBlurQuality, 1, 
                        [settings.get_double('unicorn-fart-blur-quality')]);

                      shader.set_uniform_float(shader._uSeed, 1, 
                        [Math.random()]);

                     });
    });
  }

  // ---------------------------------------------------------------------------- metadata

  // The effect is available on all GNOME Shell versions supported by this extension.
  static getMinShellVersion() {
    return [3, 36];
  }

  // This will be called in various places where a unique identifier for this effect is
  // required. It should match the prefix of the settings keys which store whether the
  // effect is enabled currently (e.g. '*-enable-effect'), and its animation time
  // (e.g. '*-animation-time'). Also, the shader file and the settings UI files should be
  // named likes this.
  static getNick() {
    return 'unicorn-fart';
  }

  // This will be shown in the sidebar of the preferences dialog as well as in the
  // drop-down menus where the user can choose the effect.
  static getLabel() {
    return _('UnicornFart');
  }

  // -------------------------------------------------------------------- API for prefs.js

  // This is called by the preferences dialog whenever a new effect profile is loaded. It
  // binds all user interface elements to the respective settings keys of the profile.
  static bindPreferences(dialog) {
    // Empty for now... Code is added here later in the tutorial!

    dialog.bindAdjustment('unicorn-fart-animation-time');

    //ints and floats
    dialog.bindAdjustment('unicorn-fart-particle-size');
    dialog.bindAdjustment('unicorn-fart-particle-speed');
    dialog.bindAdjustment('unicorn-fart-particle-color-random');
    dialog.bindAdjustment('unicorn-fart-particle-color-speed');

    dialog.bindAdjustment('unicorn-fart-spark-count');
    dialog.bindAdjustment('unicorn-fart-spark-start');
    dialog.bindAdjustment('unicorn-fart-spark-end');
    dialog.bindAdjustment('unicorn-fart-spark-offset');

    dialog.bindAdjustment('unicorn-fart-star-count');
    dialog.bindAdjustment('unicorn-fart-star-rotation');
    dialog.bindAdjustment('unicorn-fart-star-size');
    dialog.bindAdjustment('unicorn-fart-star-start');
    dialog.bindAdjustment('unicorn-fart-star-end');
    dialog.bindAdjustment('unicorn-fart-blur-quality');

    //switches
    dialog.bindSwitch('unicorn-fart-particles-enable');

    //star-color
    dialog.bindColorButton('unicorn-fart-star-color-0');
    dialog.bindColorButton('unicorn-fart-star-color-1');
    dialog.bindColorButton('unicorn-fart-star-color-2');
    dialog.bindColorButton('unicorn-fart-star-color-3');
    dialog.bindColorButton('unicorn-fart-star-color-4');
    dialog.bindColorButton('unicorn-fart-star-color-5');

    //particle-colors
    dialog.bindColorButton('unicorn-fart-particle-color-0');
    dialog.bindColorButton('unicorn-fart-particle-color-1');
    dialog.bindColorButton('unicorn-fart-particle-color-2');
    dialog.bindColorButton('unicorn-fart-particle-color-3');
    dialog.bindColorButton('unicorn-fart-particle-color-4');
    dialog.bindColorButton('unicorn-fart-particle-color-5');

  }

  // ---------------------------------------------------------------- API for extension.js

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. This is useful if the effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  static getActorScale(settings, forOpening, actor) {
    return {x: 1.0, y: 1.0};
  }
}