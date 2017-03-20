// tiles //
attribute vec2 coord;
varying vec2 v_coord;
uniform vec2 size;
uniform mat4 m_vp;
uniform vec4 color;

uniform sampler2D s_map;
uniform sampler2D s_lut;

// tiles.vertex //
void main() {
    vec2 C = size * coord;
    vec3 P = vec3(C.x, 0.0, -C.y);
    gl_Position = m_vp * vec4(P, 1.0);
    v_coord = coord;
}

// tiles.fragment //
#extension GL_OES_standard_derivatives : enable

float grid(vec2 co) {
    float divisions = 1.0;
    float thickness = 0.025;
    float delta = 0.05 / 2.0;

    float x = fract(co.x * divisions);
    x = min(x, 1.0 - x);

    float xdelta = fwidth(x);
    x = smoothstep(x - xdelta, x + xdelta, thickness);

    float y = fract(co.y * divisions);
    y = min(y, 1.0 - y);

    float ydelta = fwidth(y);
    y = smoothstep(y - ydelta, y + ydelta, thickness);

    float c = clamp(x + y, 0.0, 1.0);

    return c;
}

void main() {
    float v = texture2D(s_map, v_coord).r;
    vec3 vcol = texture2D(s_lut, vec2(v, 0.0)).rgb;

    //vec2 x = fract(v_coord);
    //vec2 c = 1.0 - step(0.01, x);
    //float dd = max(c.x, c.y);

    //gl_FragColor = cc * color;

    gl_FragColor.rgb += 0.5 * vcol;
    
    float cc = grid(size * v_coord);
    gl_FragColor.rgb += cc * (color.rgb * color.a);

    gl_FragColor.a = 1.0;
}
