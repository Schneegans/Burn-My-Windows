// SPDX-License-Identifier: GPL-3.0-or-later

uniform float uFadeWidth;

void main() {
    // 1. Define the center of the screen
    vec2 center = vec2(0.5, 0.5);
    vec2 uv = iTexCoord.st;
    
    // Calculate distance and direction to the center
    vec2 dir = center - uv;
    float dist = length(dir);

    // 2. Set up the animation timeline (0.0 is open, 1.0 is closed)
    float progress = uForOpening ? 1.0 - uProgress : uProgress;

    // --- GRAVITATIONAL LENSING (Warping the window) ---
    // The pull gets violently stronger as the animation progresses
    float gravity = pow(progress, 3.0) * 1.5;
    
    // Suck the pixels towards the center
    vec2 warpedUV = uv + (dir * gravity / (dist + 0.1)); 
    vec4 windowColor = getInputColor(warpedUV);

    // Fade the window out as it gets crushed
    windowColor.a *= (1.0 - pow(progress, 2.0));

    // --- THE EVENT HORIZON (The black sphere) ---
    float eventHorizonRadius = 0.08 * (progress * 3.0); 
    float isBlackHole = 1.0 - smoothstep(eventHorizonRadius - 0.01, eventHorizonRadius, dist);

    // --- THE ACCRETION DISK (The glowing ring) ---
    // We multiply dir.y by 5.0 to squash the circle into a tilted 3D ring
    float ringDist = length(vec2(dir.x, dir.y * 5.0));
    float ringRadius = eventHorizonRadius + 0.12;
    
    // Create the glowing edge
    float isRing = 1.0 - smoothstep(0.01, 0.06, abs(ringDist - ringRadius));
    
    // Make the ring glowing white/orange and fade it in
    vec3 ringColor = vec3(1.0, 0.9, 0.8) * isRing * smoothstep(0.0, 0.2, progress);
    float ringAlpha = isRing * (1.0 - pow(progress, 4.0)); // Fade out at the very end

    // --- COMBINE EVERYTHING ---
    vec4 finalColor = windowColor;
    
    // Add the glowing ring on top of the warped window
    finalColor.rgb += ringColor;
    finalColor.a = max(finalColor.a, ringAlpha);

    // Punch a pure black hole in the dead center
    if (isBlackHole > 0.5) {
        // Pure black, but fades away at the very end of the animation
        finalColor = vec4(0.0, 0.0, 0.0, 1.0 - pow(progress, 8.0));
    }

    setOutputColor(finalColor);
}