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

const {Gio, Shell, GObject} = imports.gi;
const ByteArray             = imports.byteArray;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This is the base class for all shaders of Burn-My-Windows. It automagically loads    //
// the shader's source code from the resource file resources/shaders/<nick>.glsl and    //
// ensures that some standard uniforms are always updated.                              //
//////////////////////////////////////////////////////////////////////////////////////////

var Shader = GObject.registerClass({}, class Shader extends Shell.GLSLEffect {
  // The constructor is used to store all required uniform locations. Make sure to chain
  // up to this base constructor before trying to access the uniform locations!
  _init(effect) {
    this._effect = effect;

    // This will call vfunc_build_pipeline().
    super._init();

    this._uForOpening = this.get_uniform_location('uForOpening');
    this._uProgress   = this.get_uniform_location('uProgress');
    this._uTime       = this.get_uniform_location('uTime');
    this._uSize       = this.get_uniform_location('uSize');
  }

  // This is called each time the shader is used. This can be used to retrieve the
  // configuration from the settings and update all uniforms accordingly.
  beginAnimation(actor, settings, forOpening) {
    this.set_uniform_float(this._uForOpening, 1, [forOpening]);
    this.set_uniform_float(this._uSize, 2, [actor.width, actor.height]);
  }

  // This is called at each frame during the animation. This can be used to update
  // uniforms which need to change each frame.
  updateAnimation(progress, time) {
    this.set_uniform_float(this._uProgress, 1, [progress]);
    this.set_uniform_float(this._uTime, 1, [time]);
  }

  // This is called by extension.js when the shader is not used anymore. We will
  // store this instance of the shader so that it can be re-used in th future.
  endAnimation() {
    this._effect.freeShader(this);
  }

  // This is called by the constructor. This means, it's only called when the
  // effect is used for the first time.
  vfunc_build_pipeline() {
    const code = this._loadGLSLResource(`/shaders/${this._effect.getNick()}.glsl`);

    // Match anything between the curly brackets of "void main() {...}".
    const regex = RegExp('void main *\\(\\) *\\{([\\S\\s]+)\\}');
    const match = regex.exec(code);

    const declarations = code.substr(0, match.index);
    const main         = match[1];

    this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, declarations, main, true);
  }

  // ----------------------------------------------------------------------- private stuff

  // This loads the file at 'path' contained in the extension's resources to a JavaScript
  // string.
  _loadStringResource(path) {
    const data = Gio.resources_lookup_data(path, 0);
    return ByteArray.toString(ByteArray.fromGBytes(data));
  }

  // This loads a GLSL file from the extension's resources to a JavaScript string. Any
  // #include statements in this file are replaced with the corresponding file contents.
  _loadGLSLResource(path) {
    let code = this._loadStringResource(path);

    // This regex matches either #include "..." or #include <...>. The part between the
    // brackets is captured in the capture group.
    const regex = RegExp('#include ["<](.+)[">]', 'g');

    code = code.replace(regex, (m, file) => {
      return this._loadStringResource('/shaders/' + file);
    });

    // Add a trailing newline. Else the GLSL compiler complains...
    return code + '\n';
  }
});
