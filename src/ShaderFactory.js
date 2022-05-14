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

const GObject = imports.gi.GObject;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();

//////////////////////////////////////////////////////////////////////////////////////////
// This is the base class for all effects of Burn-My-Windows. It provides the logic     //
// required for creating shader instances and reusing them as much as possible.         //
//////////////////////////////////////////////////////////////////////////////////////////

var ShaderFactory = class ShaderFactory {

  // The _freeShaders array contains previously created shaders which are not currently in
  // use.
  constructor(nick, setupFunc) {
    this._freeShaders = [];
    this._nick        = nick;
    this._setupFunc   = setupFunc;
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is opened or closed with this
  // effect. It returns an instance of the shader class, trying to reuse previously
  // created shaders. If a new shader instance is required, it calls this.createShader().
  // This method must be defined be the derived class!
  getShader() {
    let shader;

    if (this._freeShaders.length == 0) {

      const typeName = `BurnMyWindowsShader_${this._nick}`;

      if (GObject.type_from_name(typeName) == null) {
        GObject.registerClass({GTypeName: typeName},
                              class Shader extends Me.imports.src.Shader.Shader {});
      }

      shader = GObject.Object.new(GObject.type_from_name(typeName), {'nick': this._nick});

      shader.returnToFactory = () => {
        this._freeShaders.push(shader);
      };

      this._setupFunc(shader);

    } else {
      shader = this._freeShaders.pop();
    }

    return shader;
  }
}
