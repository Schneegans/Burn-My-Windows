// SPDX-License-Identifier: GPL-3.0-or-later
uniform float uBlackHoleWidth;
uniform float uBlackHoleActorScale;

void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 uv = iTexCoord.st;
    vec2 inputUV = (uv - center) * uBlackHoleActorScale + center;

    vec2 dir = center - uv;
    vec2 metricDir = dir * uSize / min(uSize.x, uSize.y);
    float dist = length(metricDir);

    float progress = uForOpening ? 1.0 - uProgress : uProgress;

    // --- GRAVITATIONAL LENSING ---
    float gravity = pow(progress, 3.0) * 1.5;
    vec2 warpedUV = inputUV + ((center - inputUV) * gravity / (dist + 0.1));
    float inBounds = step(0.0, warpedUV.x) * step(warpedUV.x, 1.0) *
                     step(0.0, warpedUV.y) * step(warpedUV.y, 1.0);
    vec4 windowColor = getInputColor(warpedUV);
    windowColor.a *= inBounds * (1.0 - pow(progress, 2.0));

    // --- EVENT HORIZON ---
    float eventHorizonRadius = uBlackHoleWidth * (progress * 3.0);
    float isBlackHole = 1.0 - smoothstep(eventHorizonRadius - 0.01, eventHorizonRadius, dist);

    // --- ACCRETION DISK ---
    float ringDist = length(vec2(metricDir.x, metricDir.y * 5.0));
    float ringRadius = eventHorizonRadius + 0.12;

    float isRing = 1.0 - smoothstep(0.01, 0.06, abs(ringDist - ringRadius));
    vec3 ringColor = vec3(1.0, 0.9, 0.8) * isRing * smoothstep(0.0, 0.2, progress);
    float ringAlpha = isRing * (1.0 - pow(progress, 4.0));

    // --- COMPOSITE ---
    vec4 finalColor = windowColor;
    finalColor.rgb += ringColor;
    finalColor.a = max(finalColor.a, ringAlpha);

    if (isBlackHole > 0.5) {
        finalColor = vec4(0.0, 0.0, 0.0, 1.0 - pow(progress, 8.0));
    }

    setOutputColor(finalColor);
}
