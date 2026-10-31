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

import GObject from 'gi://GObject';

import {Shader} from './Shader.js';

//////////////////////////////////////////////////////////////////////////////////////////
// Each effect of Burn-My-Windows owns an instance of this class. It is used to create  //
// shaders whenever a new one is required. It tries to re-use old shaders as much as    //
// possible in order to avoid memory leaks.                                             //
//////////////////////////////////////////////////////////////////////////////////////////

// The free shaders are stored in this module-global cache which is shared by all
// ShaderFactory instances. This is required because GNOME Shell disables and re-enables
// all extensions whenever the screen is locked and unlocked: Each of these cycles
// creates new ShaderFactory instances, while the GObject classes below are registered
// only once per shell session and are never unregistered. If the free shaders were owned
// by the factory instances, then the registered classes would keep the factories of the
// very first enable() alive forever and all shaders created after a lock/unlock cycle
// would be returned to these leaked factories, where they could never be re-used. This
// would leak GPU memory with every window animation.
const _freeShaders = new Map();

export default class ShaderFactory {

  // Creates a new ShaderFactory. Requires the nick of the effect and a callback function
  // which will be called whenever a new shader is created.
  constructor(nick, setupFunc) {

    // The nick of the effect is required when creating new shaders as it's part of the
    // GLSL source code file name.
    this._nick = nick;

    // Store the setup callback.
    this._setupFunc = setupFunc;
  }

  // ---------------------------------------------------------------- API for extension.js

  // Drops all currently unused shaders of all effects so that they can be garbage
  // collected. This should be called when the extension is disabled.
  static freeAll() {
    _freeShaders.clear();
  }

  // This is called from extension.js whenever a window is opened or closed. It returns an
  // instance of the shader class, trying to reuse previously created shaders. If a new
  // shader instance is required, it calls creates a new one and calls the setupFunc
  // thereafter.
  getShader() {
    let shader;

    // The array of this effect's shaders which are currently not in use.
    if (!_freeShaders.has(this._nick)) {
      _freeShaders.set(this._nick, []);
    }
    const freeShaders = _freeShaders.get(this._nick);

    // If there are currently no free shaders, we have to create a new one.
    if (freeShaders.length == 0) {

      // Since Shell.GLSLEffect caches the shader source per class (not per instance), we
      // have to derive a new shader type for each effect. The type name contains the nick
      // of the effect to make it unique.
      const typeName = `BurnMyWindowsShader_${this._nick}`;

      // Only try to register the new type once.
      if (GObject.type_from_name(typeName) == null) {
        const nick = this._nick;
        GObject.registerClass({GTypeName: typeName}, class ShaderImp extends Shader {
          // This will actually load the GLSL source code from the resources.
          _init() {
            super._init(nick);
          }

          // This can be called to mark this instance to be re-usable.
          returnToFactory() {
            if (!_freeShaders.has(nick)) {
              _freeShaders.set(nick, []);
            }
            _freeShaders.get(nick).push(this);
          }
        });
      }

      // Now create a niew instance of the newly registered shader type.
      // GObject.Object.new is only available with newer versions of GJS.
      if (GObject.Object.new) {
        shader = GObject.Object.new(GObject.type_from_name(typeName), {});
      } else {
        shader = GObject.Object.newv(GObject.type_from_name(typeName), []);
      }

      // Call the provided setup callback.
      this._setupFunc(shader);

    } else {
      shader = freeShaders.pop();
    }

    return shader;
  }
}