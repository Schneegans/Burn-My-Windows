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

//////////////////////////////////////////////////////////////////////////////////////////
// This is the base class for all effects of Burn-My-Windows. It provides the logic     //
// required for creating shader instances and reusing them as much as possible.         //
//////////////////////////////////////////////////////////////////////////////////////////

var Effect = class Effect {

  // The _freeShaders array contains previously created shaders which are not currently in
  // use.
  constructor() {
    this._freeShaders = [];
  }

  // ---------------------------------------------------------------- API for extension.js

  // This is called from extension.js whenever a window is opened or closed with this
  // effect. It returns an instance of the shader class, trying to reuse previously
  // created shaders. If a new shader instance is required, it calls this.createShader().
  // This method must be defined be the derived class!
  getShader(actor, settings, forOpening) {
    let shader;

    if (this._freeShaders.length == 0) {
      shader = this.createShader(this);
    } else {
      shader = this._freeShaders.pop();
    }

    shader.updateAnimation(actor, settings, forOpening);

    return shader;
  }

  // This is called from extension.js whenever a shader previously retrieved with
  // getShader() is not used anymore.
  freeShader(shader) {
    this._freeShaders.push(shader);
  }

  // ------------------------------------- "virtual" methods - feel free to override them!

  // The getActorScale() is called from extension.js to adjust the actor's size during the
  // animation. Override this, if your effect requires drawing something beyond the usual
  // bounds of the actor. This only works for GNOME 3.38+.
  getActorScale(settings) {
    return {x: 1.0, y: 1.0};
  }

  // This is called from extension.js if the extension is disabled. This should free all
  // static resources. So if you have to delete some textures for example, you should
  // override this.
  cleanUp() {
    freeShaders = [];
  }
}
