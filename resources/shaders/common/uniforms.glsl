// These should be included in every shader.
// uForOpening: True if a window-open animation is ongoing, false otherwise.
// uTexture:    Contains the texture of the window.
// uProgress:   A value which transitions from 0 to 1 during the entire animation.
// uTime:       A steadily increasing value in seconds.
// uSize:       The size of uTexture in pixels.
uniform bool uForOpening;
uniform sampler2D uTexture;
uniform float uProgress;
uniform float uTime;
uniform vec2 uSize;