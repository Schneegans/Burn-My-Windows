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

uniform vec3 uColor;

const float PORTAL_OPEN_TIME       = 0.3;
const float PORTAL_WOBBLE_TIME     = 0.8;
const float PORTAL_WOBBLE_STRENGTH = 1.2;
const float PORTAL_CLOSE_TIME      = 0.3;
const float PORTAL_ROTATION_SPEED  = 0.3;
const float PORTAL_WARPING         = 3.0;
const float GLOW_EDGE_WIDTH        = 5.0;

const float WINDOW_ANIMATION_TIME = 0.3;
const float WINDOW_SCALE          = 0.3;
const float WINDOW_SQUISH         = 1.0;
const float WINDOW_TILT           = -1.0;

vec2 getPortalWobble(vec2 coords) {
  float progress = (uForOpening ? (1.0 - uProgress) : uProgress) / WINDOW_ANIMATION_TIME;
  progress       = clamp(1.0 - abs((progress - 1.0) / PORTAL_WOBBLE_TIME), 0.0, 1.0);
  progress       = easeInBack(progress, 1.7);
  float dist     = length(coords);

  return coords * (1.0 - dist) * exp(-dist) * progress * PORTAL_WOBBLE_STRENGTH;
}

float getPortalScale() {
  float scale = 1.0;
  if (uProgress < PORTAL_OPEN_TIME) {
    scale = easeOutBack(uProgress / PORTAL_OPEN_TIME, 1.5);
  } else if (uProgress > 1.0 - PORTAL_CLOSE_TIME) {
    scale =
      easeOutBack(1.0 - (uProgress - 1.0 + PORTAL_CLOSE_TIME) / PORTAL_CLOSE_TIME, 1.5);
  }

  return scale;
}

vec2 getRandomDisplace(vec2 coords, float scale) {
  return vec2(simplex2D(coords * scale) - 0.5,
              simplex2D(coords * scale + vec2(7.89, 123.0)) - 0.5);
}

vec2 getWhirledCoords(vec2 coords, float speedMultiplier, float warpMultiplier) {
  float rotation = PORTAL_ROTATION_SPEED * uProgress * uDuration * speedMultiplier;
  float warping  = PORTAL_WARPING * (2.0 + 0.5 * uProgress) * warpMultiplier;
  return whirl(coords, warping, rotation);
}

vec4 getPortalColor() {

  // Put coordinate origin to the center of the window and make ensure a 1:1 aspect ratio.
  vec2 coords = (iTexCoord.st - vec2(0.5)) * 2.0;
  // vec2 coords = (iTexCoord.st - vec2(0.5)) * 2.0 * uSize * vec2(1.0, 0.75) /
  // vec2(min(uSize.x, uSize.y * 0.75));

  float scaleFac = 1000.0 / (uSize.x + uSize.y);

  // Add some margin for the elastic overshooting.
  coords *= 1.5;

  float scale = getPortalScale();
  coords /= max(scale, 0.01);

  vec2 wobble = getPortalWobble(coords);

  vec2 coords1 = getWhirledCoords(coords - wobble * 1.0, 0.5, 1.0);
  vec2 coords2 = getWhirledCoords(coords - wobble * 1.5, 1.5, 0.5);
  vec2 coords3 = getWhirledCoords(coords - wobble * 1.8, 2.5, 0.0);

  vec2 displace1 = getRandomDisplace(coords1, 2.1);
  vec2 displace2 = getRandomDisplace(coords2, 12.2);

  coords1 += displace1 * 0.1;
  coords2 += displace2 * 0.1;

  float dist           = length(coords1);
  vec3 backgroundColor = mix(0.2 * uColor, 0.8 * uColor, clamp(pow(dist, 5.0), 0.0, 1.0));
  float alpha          = dist > 1.0 ? 0.0 : 1.0;
  vec4 color           = vec4(backgroundColor, alpha);

  float glowingEdge =
    clamp((mix(1.0, 5.0, dot(displace1, displace1)) * GLOW_EDGE_WIDTH * scaleFac -
           150.0 * abs(dist - 1.0)),
          0.0, 1.0);

  float bands1 =
    simplex2D(coords1 / scaleFac * 1.0 + vec2(12.3, 56.4)) > 0.6 ? alpha : 0.0;
  float bands2 = simplex2D(coords2 / scaleFac * 1.3) > 0.6 ? alpha : 0.0;

  color = alphaOver(color, vec4(uColor * 0.7, bands1));
  color = alphaOver(color, vec4(uColor, bands2));

  color = clamp(color, 0.0, 1.0);

  color = alphaOver(color, vec4(uColor, glowingEdge));

  float noise = simplex2D(coords3 / scaleFac * 3.0);

  float sparkles = clamp(pow(noise * dot(displace1, displace1) + 0.9, 50.0), 0.0, 1.0);
  color.rgb += vec3(1.0, 1.0, 0.7) * sparkles;

  color.a *= pow(clamp(scale, 0.0, 1.0), 2.0);

  return clamp(color, 0.0, 1.0);
}

vec4 getWindowColor() {
  float progress = (uForOpening ? (1.0 - uProgress) : uProgress) / WINDOW_ANIMATION_TIME;

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

  // Dissolve window.
  vec4 oColor = getInputColor(coords);
  oColor.a *= clamp((1.0 - progress) * 3.0, 0.0, 1.0);

  return oColor;
}

void main() {
  vec4 portal = getPortalColor();
  vec4 window = getWindowColor();

  setOutputColor(alphaOver(portal, window));

  // These can be useful for understanding how this works.
  // setOutputColor(portal);
  // setOutputColor(window);
}