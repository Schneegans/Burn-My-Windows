// This part is automatically included in the effect's source during the build process.
// The code below is called whenever a window is closed or opened.

let seed     = [Math.random(), Math.random()];
let startPos = seed[0] > seed[1] ? [seed[0], Math.floor(seed[1] + 0.5)] :
                                   [Math.floor(seed[0] + 0.5), seed[1]];

if (effect.readConfig('UsePointer', true)) {
  startPos = [
    (effects.cursorPos.x - window.x) / window.width,
    (effects.cursorPos.y - window.y) / window.height
  ];
}

effect.setUniform(this.shader, 'uSeed', seed);
effect.setUniform(this.shader, 'uStartPos', startPos);