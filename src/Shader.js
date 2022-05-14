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

const {Gio, Shell, GObject, Clutter} = imports.gi;
const ByteArray                      = imports.byteArray;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// This is the base class for all shaders of Burn-My-Windows. It automagically loads    //
// the shader's source code from the resource file resources/shaders/<nick>.glsl and    //
// ensures that some standard uniforms are always updated.                              //
// Using Shell.GLSLEffect as a base class has some benefits and some drawbacks. The     //
// main benefit when compared to Clutter.ShaderEffect is that setting uniforms of types //
// vec2, vec3 or vec4 is supported via the API (with Clutter.ShaderEffect the GJS       //
// binding does not work properly). However, there are two drawbacks: On the one hand,  //
// the shader source code is cached statically - this mean if we want to have a         //
// different shader, we have to derive a new class. Therefore, each effect has to       //
// derive its own class from the class below. The other drawback is the hard-coded use  //
// of straight alpha (as opposed to premultiplied). This makes the shaders a bit more   //
// complicated than required.                                                           //
//////////////////////////////////////////////////////////////////////////////////////////

var Shader = GObject.registerClass(
  {
    Signals: {
      'begin-animation':
        {param_types: [Gio.Settings.$gtype, GObject.TYPE_BOOLEAN, Clutter.Actor.$gtype]},
      'update-animation': {param_types: [GObject.TYPE_DOUBLE, GObject.TYPE_DOUBLE]},
      'paint-target': {param_types: []},
    }
  },
  class Shader extends Shell.GLSLEffect {  // --------------------------------------------
    // The constructor is used to store all required uniform locations. Make sure to chain
    // up to this base constructor before trying to access the uniform locations! It
    // automagically loads the shader's source code from the resource file
    // resources/shaders/<nick>.glsl resolving any #includes in this file.
    _init(params) {
      this._nick = params.nick;

      // This will call vfunc_build_pipeline().
      super._init();

      this._uForOpening = this.get_uniform_location('uForOpening');
      this._uProgress   = this.get_uniform_location('uProgress');
      this._uTime       = this.get_uniform_location('uTime');
      this._uSize       = this.get_uniform_location('uSize');
    }

    // This is called each time the shader is used. This can be used to retrieve the
    // configuration from the settings and update all uniforms accordingly.
    beginAnimation(settings, forOpening, actor) {
      this.set_uniform_float(this._uForOpening, 1, [forOpening]);
      this.set_uniform_float(this._uSize, 2, [actor.width, actor.height]);

      this.emit('begin-animation', settings, forOpening, actor);
    }

    // This is called at each frame during the animation. This can be used to update
    // uniforms which need to change each frame.
    updateAnimation(progress, time) {
      this.set_uniform_float(this._uProgress, 1, [progress]);
      this.set_uniform_float(this._uTime, 1, [time]);

      this.emit('update-animation', progress, time);
    }

    // This is called by the constructor. This means, it's only called when the
    // effect is used for the first time.
    vfunc_build_pipeline() {
      const code = this._loadGLSLResource(`/shaders/${this._nick}.glsl`);

      // Match anything between the curly brackets of "void main() {...}".
      const regex = RegExp('void main *\\(\\) *\\{([\\S\\s]+)\\}');
      const match = regex.exec(code);

      const declarations = code.substr(0, match.index);
      const main         = match[1];

      this.add_glsl_snippet(Shell.SnippetHook.FRAGMENT, declarations, main, true);
    }

    // This is overridden to bind textures for drawing.
    vfunc_paint_target(node, paint_context) {
      this.emit('paint-target');
      super.vfunc_paint_target(node, paint_context);
    }

    // --------------------------------------------------------------------- private stuff

    // This loads the file at 'path' contained in the extension's resources to a
    // JavaScript string.
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
