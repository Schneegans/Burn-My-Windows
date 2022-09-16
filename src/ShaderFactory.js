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

const GObject = imports.gi.GObject;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();

//////////////////////////////////////////////////////////////////////////////////////////
// Each effect of Burn-My-Windows owns an instance of this class. It is used to created //
// shaders whenever a new one is required. It tries to re-use old shaders as much as    //
// possible in order to avoid memory leaks.                                             //
//////////////////////////////////////////////////////////////////////////////////////////

var ShaderFactory = class {

  // Creates a new ShaderFactory. Requires the nick of the effect and a callback function
  // which will be called whenever a new shader is created.
  constructor(nick, setupFunc) {
    // The _freeShaders array contains previously created shaders which are not currently
    // in use.
    this._freeShaders = [];

    // The nick of the effect is required when creating new shaders as it's part of the
    // GLSL source code file name.
    this._nick = nick;

    // Store the setup callback.
    this._setupFunc = setupFunc;
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is opened or closed. It returns an
  // instance of the shader class, trying to reuse previously created shaders. If a new
  // shader instance is required, it calls creates a new one and calls the setupFunc
  // thereafter.
  getShader() {
    let shader;

    // If there are currently no free shaders, we have to create a new one.
    if (this._freeShaders.length == 0) {

      // Since Shell.GLSLEffect caches the shader source per class (not per instance), we
      // have to derive a new shader type for each effect. The type name contains the nick
      // of the effect to make it unique.
      const typeName = `BurnMyWindowsShader_${this._nick}`;

      // Only try to register the new type once.
      if (GObject.type_from_name(typeName) == null) {
        const outerThis = this;
        GObject.registerClass({GTypeName: typeName},
                              class Shader extends Me.imports.src.Shader.Shader {
          // This will actually load the GLSL source code from the resources.
          _init() {
            super._init(outerThis._nick);
          }

          // This can be called to mark this instance to be re-usable.
          returnToFactory() {
            outerThis._freeShaders.push(this);
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
      shader = this._freeShaders.pop();
    }

    return shader;
  }
}
