// This part is automatically included in the effect's source during the build process.
// The code below is called whenever a window is closed or opened.

let startPos = [
  Math.min(1.0, Math.max(0.0, (effects.cursorPos.x - window.x) / window.width)),
  Math.min(1.0, Math.max(0.0, (effects.cursorPos.y - window.y) / window.height))
];

effect.setUniform(this.shader, 'uStartPos', startPos);
