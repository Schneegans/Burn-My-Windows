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

// The content from common.glsl is automatically prepended to each shader effect.

uniform vec2 uSeed;
uniform vec3 uColor;
uniform float uRotationSpeed;
uniform float uWhirling;
uniform float uDetails;

const float PORTAL_WOBBLE_TIME     = 0.8;
const float PORTAL_WOBBLE_STRENGTH = 1.2;
const float GLOW_EDGE_WIDTH        = 5.0;
const float WINDOW_SCALE           = 0.3;
const float WINDOW_SQUISH          = 1.0;
const float WINDOW_TILT            = -1.0;

// Make sure that the portal and window open / close animations are quick even if the
// duration is longer.
float PORTAL_OPEN_TIME  = 0.4;
float PORTAL_CLOSE_TIME = 0.4;
float WINDOW_OPEN_TIME  = 0.35;

// This will distort the given coordinate to achieve the wobble effect of the portal when
// the window passes through. The wobble happens around the point where the window appears
// or disappears (which is controlled by WINDOW_OPEN_TIME) and takes
// PORTAL_WOBBLE_TIME.
vec2 getPortalWobble(vec2 coords) {
  float progress =
    (uForOpening ? (1.0 - uProgress) : uProgress) / WINDOW_OPEN_TIME * uDuration;
  progress   = clamp(1.0 - abs((progress - 1.0) / PORTAL_WOBBLE_TIME), 0.0, 1.0);
  progress   = easeInBack(progress, 1.7);
  float dist = length(coords);

  return coords * (1.0 - dist) * exp(-dist) * progress * PORTAL_WOBBLE_STRENGTH;
}

// This is used to compute the scale of the portal. The returned value will smoothly
// increase during uDuration*PORTAL_OPEN_TIME, stay at one until uDuration*(1.0 -
// PORTAL_CLOSE_TIME) and then decrease again.
float getPortalScale() {
  float scale     = 1.0;
  float closeTime = PORTAL_CLOSE_TIME / uDuration;
  float openTime  = PORTAL_OPEN_TIME / uDuration;
  if (uProgress < openTime) {
    scale = easeOutBack(uProgress / openTime, 1.5);
  } else if (uProgress > 1.0 - closeTime) {
    scale = easeOutBack(1.0 - (uProgress - 1.0 + closeTime) / closeTime, 1.5);
  }

  return scale;
}

// Returns a random 2D vector in [(-0.5, -0.5) ... (0.5, 0.5)] using two time simplex
// noise. The scale of the noise can be adjusted with the scale paramter.
vec2 getRandomDisplace(vec2 seed, float scale) {
  return vec2(simplex2D(seed * scale + uSeed) - 0.5,
              simplex2D(seed * scale + uSeed + vec2(7.89, 123.0)) - 0.5);
}

// Twists the given coordinates around the origin. The speedMultiplier can be used to
// control the overall rotation speed, warpMultiplier can be used to control the amount of
// twisting (higher multipliers will make coordinates which are closer to the origin be
// rotated more than coordinates farther away).
vec2 getWhirledCoords(vec2 coords, float speedMultiplier, float warpMultiplier) {
  float rotation = uRotationSpeed * uProgress * uDuration * speedMultiplier;
  float warping  = uWhirling * (6.0 + 1.5 * uProgress) * warpMultiplier;
  return whirl(coords, warping, rotation);
}

// This returns a beautiful portal. It is composed of several layers:
// 1. In the background, there is a slightly distorted radial gradient.
// 2. Next, there is a layer of whirled bands.
// 3. Thereafter, there is another layer of whirled bands, rotating a bit faster and
//    usually in a slightly brighter color.
// 4. Then the rim of the portal is drawn.
// 5. Finally, some bright sparkling dots are drawn above.
vec4 getPortalColor() {

  // Put coordinate origin to the center of the window.
  vec2 coords = (iTexCoord.st - vec2(0.5)) * 2.0;

  // Add some margin for the elastic overshooting.
  coords *= 1.5;

  // Add the open-close animation of the portal.
  float scale = getPortalScale();
  coords /= max(scale * 0.5 + 0.5, 0.01);

  // We will use this distortion vector on all layers below in order to add the elastic
  // wobbling when the window passes through the portal.
  vec2 wobble = getPortalWobble(coords);

  // This is used below to scale the detail level of the layers. If the portal is small,
  // we want to have less details, if the portal is huge on the screen, theres plenty of
  // space for details.
  float detailScale = 10000.0 / (uSize.x + uSize.y) / uDetails;

  // ---------------------------------------------------------------------------- 1. layer
  // We start with the background layer. This is a radial gradient from a dark color in
  // the center to a not-so-dark color in the outer regions. We distort the coordinates to
  // add some variations to the colors and to the shape of the portal.
  vec2 layerCoords = getWhirledCoords(coords - wobble * 1.0, 0.25, 1.0);
  vec2 displace    = getRandomDisplace(layerCoords, 2.1);
  layerCoords += displace * 0.1;
  float dist  = length(layerCoords);
  float alpha = dist > 1.0 ? 0.0 : 1.0;
  vec4 color = vec4(mix(darken(uColor, 0.8), darken(uColor, 0.2), pow(dist, 5.0)), alpha);
  float rand = dot(displace, displace);

  // ---------------------------------------------------------------------------- 2. layer
  // Then we add the first layer of whirly bands.
  float noise = simplex2D(layerCoords / detailScale * 1.0 + vec2(12.3, 56.4) + uSeed);
  vec4 layer  = vec4(darken(uColor, 0.3), noise > 0.6 ? alpha : 0.0);
  color       = alphaOver(color, layer);

  // ---------------------------------------------------------------------------- 3. layer
  // The second layer of whirly bands uses a lighter color and a different set of
  // distorted coordinates.
  layerCoords = getWhirledCoords(coords - wobble * 1.5, 0.75, 0.5);
  displace    = getRandomDisplace(layerCoords, 12.2);
  layerCoords += displace * 0.1;
  noise = simplex2D(layerCoords / detailScale * 1.3 + uSeed);
  layer = vec4(uColor, noise > 0.6 ? alpha : 0.0);
  color = alphaOver(color, layer);

  // At this point, some of the color components can be outside the [0..1] range, so we
  // have to clamp them. Else the alpha compositing will create artifacts.
  color = clamp(color, 0.0, 1.0);

  // ---------------------------------------------------------------------------- 4. layer
  // Then we add the edge around the portal with the effect's color. It varies in
  // thickness to create some variations.
  float edge =
    mix(1.0, 5.0, rand) * GLOW_EDGE_WIDTH * detailScale - 150.0 * abs(dist - 1.0);
  layer = vec4(uColor, clamp(edge, 0.0, 1.0));
  color = alphaOver(color, layer);

  // ---------------------------------------------------------------------------- 5. layer
  // Finally, we add some sparkling lights.
  layerCoords = getWhirledCoords(coords - wobble * 1.8, 1.25, 0.0);
  noise       = simplex2D(layerCoords / detailScale * 3.0 + uSeed);
  layer.rgb   = lighten(uColor, 0.8) * clamp(pow(noise * rand + 0.9, 50.0), 0.0, 1.0);
  color.rgb += layer.rgb;

  // Finally, fade in / out the portal when it appears / disappears.
  color.a *= pow(clamp(scale, 0.0, 1.0), 2.0);
  return clamp(color, 0.0, 1.0);
}

// This method returns the window texture. The window is scaled down / up and faded to /
// from transparency to create the illusion of travelling through the portal. The
// animation will happen in a fraction of the full animation time (at the end of the
// animation when opening a window and at the beginning of the animation when closing the
// window). The fraction of the animation time take for the window animation is defined by
// WINDOW_OPEN_TIME.
vec4 getWindowColor() {
  float progress =
    (uForOpening ? (1.0 - uProgress) : uProgress) / WINDOW_OPEN_TIME * uDuration;

  // Add some elastic easing to make the effect more dynamic.
  progress = easeInBack(clamp(progress, 0.0, 1.0), 1.2);

  // Put texture coordinate origin to center of window.
  vec2 coords = iTexCoord.st * 2.0 - 1.0;

  // Scale image texture with progress.
  coords /= mix(1.0, WINDOW_SCALE, progress);

  // Squish image texture vertically.
  coords.y /= mix(1.0, (1.0 - 0.2 * WINDOW_SQUISH), progress);

  // 'Tilt' image texture around x-axis.
  coords.x /= mix(1.0, 1.0 - 0.1 * WINDOW_TILT * coords.y, progress);

  // Move texture coordinate center to corner again.
  coords = coords * 0.5 + 0.5;

  // Fade the window to transparency. We multiply the progress with 3.0 in order to start
  // the fade quite late.
  vec4 oColor = getInputColor(coords);
  oColor.a *= clamp((1.0 - progress) * 3.0, 0.0, 1.0);

  return oColor;
}

void main() {

  // Get the window color and the portal color and simply combine them.
  vec4 portal = getPortalColor();
  vec4 window = getWindowColor();
  setOutputColor(alphaOver(portal, window));

  // These can be useful for understanding how this works.
  // setOutputColor(portal);
  // setOutputColor(window);
}
