// simple //
attribute vec3 position;

// simple.vertex //
uniform mat4 mvp;

void main() {
    gl_Position = mvp * vec4(position, 1.0);
}

// simple.fragment //
uniform vec4 color;
void main() {
    gl_FragColor = color;
}



// lyric //
attribute vec2 coord;

// lyric.vertex //
uniform mat4 m_vp;
uniform mat4 m_obj;
uniform float time;
uniform float distort_scale;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec2 distort(vec2 co, float time) {
    vec2 o;
    float scale = 0.015;
    o.x = co.x + distort_scale * (rand(vec2(time + co.x, co.y)) - 0.5);
    o.y = co.y + distort_scale * (rand(vec2(time + co.x + 4.2323, co.y + 83.2392)) - 0.5);
    return o;
}

void main() {
    vec3 P = vec3(coord.x, coord.y, 0.0);
    P.xy = distort(P.xy, 0.000002*time);
    gl_Position = m_vp * m_obj * vec4(P, 1.0);
}

// lyric.fragment //
uniform vec4 color;
void main() {
    gl_FragColor = color;
}



// placard //
attribute vec2 coord;
varying vec2 v_texcoord;
varying vec3 v_view;

// placard.vertex //
uniform mat4 m_vp;
uniform mat4 m_obj;
uniform vec3 view_pos;
uniform float texpos;

void main() {
    vec3 P = vec3(coord.x - 0.5, coord.y, 0.0);
    P = (m_obj * vec4(P, 1.0)).xyz;
    v_view = (view_pos - P);
    gl_Position = m_vp * vec4(P, 1.0);
    v_texcoord = vec2(0.5*(coord.x + texpos), coord.y);
}

// placard.fragment //
uniform sampler2D s_image;
uniform vec2 fog_range;
uniform vec3 fog_color;

void main() {
    // FIXME normals?? fog??
    vec4 Ct = texture2D(s_image, v_texcoord.xy);
    gl_FragColor = Ct;

    {
        float fog_start = fog_range[0];
        float fog_end = fog_range[1];
        float d = length(v_view);
        float fog_factor = (fog_end - d) / (fog_end - fog_start);
        fog_factor = clamp(fog_factor, 0.0, 1.0);
        gl_FragColor.rgb = mix(fog_color, gl_FragColor.rgb, fog_factor);
    }
}



// tiles //
attribute vec2 coord;
varying vec2 v_coord;
varying vec2 v_coord_grid;

// tiles.vertex //
uniform vec2 size;
uniform mat4 m_vp;

void main() {
    vec2 C = size * coord;
    vec3 P = vec3(C.x, 0.0, -C.y);
    gl_Position = m_vp * vec4(P, 1.0);
    v_coord = coord;
    v_coord_grid = C;
}

// tiles.fragment //
#extension GL_OES_standard_derivatives : enable

uniform vec4 color;
uniform sampler2D s_map;
uniform sampler2D s_lut;

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
    gl_FragColor.rgb = vec3(0.0);

    float v = texture2D(s_map, v_coord).r;
    vec3 vcol = texture2D(s_lut, vec2(v, 0.0)).rgb;
    gl_FragColor.rgb += 0.5 * vcol;

    float cc = grid(v_coord_grid);
    gl_FragColor.rgb += cc * (color.rgb * color.a);

    gl_FragColor.a = 1.0;
}



// tmd //
attribute vec3 position;
attribute vec3 normal;
attribute vec3 color;
attribute vec3 texcoord;

varying vec3 v_color;
varying vec3 v_light;
varying vec3 v_view;
varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_texcoord;

// tmd.vertex //
uniform mat4 m_vp;
uniform mat4 m_obj;

uniform vec3 view_pos;
uniform vec3 light_pos;

void main() {
    vec3 P = position;
    P.y = -P.y;
    P.z = -P.z;

    vec3 N = normal / 4096.0;
    N.y = -N.y;
    N.z = -N.z;

    P = (m_obj * vec4(P, 1.0)).xyz;
    N = (m_obj * vec4(N, 0.0)).xyz;

    v_view = (view_pos - P);
    v_light = (light_pos - P);
    v_position = P;
    v_color = color;
    v_normal = normalize(N);
    v_texcoord = vec2(texcoord.x / 2048.0, texcoord.y / 512.0);

    gl_Position = m_vp * vec4(P, 1.0);
}

// tmd.fragment //
uniform sampler2D s_tix;
uniform vec3 ambient;
uniform vec2 fog_range;
uniform vec3 fog_color;

// FIXME lighting calc should be in vertex shader ??
void main() {
    vec3 N = normalize(v_normal);
    vec3 V = normalize(v_view);
    vec3 L = normalize(v_light);
    vec3 H = normalize(L + V);

    float NdotL = max(0.0, dot(N, L));
    vec3 Kd = ambient + vec3(2.0 * NdotL);
    vec3 Cd = v_color;
    vec3 C = Kd * Cd;

    if (v_texcoord.x > 0.0) {
        vec4 Ct = texture2D(s_tix, v_texcoord.xy);
        if (Ct.a < 0.5) discard;
        gl_FragColor.rgb = C * Ct.rgb;
    } else {
        gl_FragColor.rgb = C;
    }

    gl_FragColor.a = 1.0;

    // fog:
    {
        float fog_start = fog_range[0];
        float fog_end = fog_range[1];
        float d = length(v_view);
        float fog_factor = (fog_end - d) / (fog_end - fog_start);
        fog_factor = clamp(fog_factor, 0.0, 1.0);
        gl_FragColor.rgb = mix(fog_color, gl_FragColor.rgb, fog_factor);
    }
}
