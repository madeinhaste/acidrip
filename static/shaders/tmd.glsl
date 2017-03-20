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

uniform mat4 m_vp;
uniform mat4 m_obj;

uniform vec3 view_pos;
uniform vec3 light_pos;
uniform sampler2D s_tix;

uniform vec3 debug_color;
uniform float ambient;
uniform vec2 fog_range;
uniform vec3 fog_color;

// tmd.vertex //
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

/*
#extension GL_OES_standard_derivatives : enable

// magic normals
vec3 face_normal(vec3 pos) {
    vec3 fdx = dFdx(pos);
    vec3 fdy = dFdy(pos);
    return normalize(cross(fdx, fdy));
}
*/

// FIXME lighting calc should be in vertex shader
void main() {
    //vec3 N = face_normal(v_position);
    vec3 N = normalize(v_normal);
    vec3 V = normalize(v_view);
    vec3 L = normalize(v_light);
    vec3 H = normalize(L + V);

    float NdotL = max(0.0, dot(N, L));
    float NdotH = max(0.0, dot(N, H));
    //float Ka = 0.45;
    float Ka = ambient;
    float Kd = Ka + 2.0*NdotL;
    float Ks = pow(NdotH, 30.0);

    vec3 Cd = v_color;
    //vec3 Cs = vec3(0.5);
    //vec3 C = Kd * Cd + Ks * Cs;
    vec3 C = Kd * Cd;

    if (v_texcoord.x > 0.0) {
        vec4 Ct = texture2D(s_tix, v_texcoord.xy);
        if (Ct.a < 0.5) discard;
        gl_FragColor.rgb = C * Ct.rgb;
    } else {
        gl_FragColor.rgb = C;
    }

    //gl_FragColor.rgb += debug_color;
    gl_FragColor.a = 1.0;

    // fog:
    {
        float fog_start = fog_range[0];
        float fog_end = fog_range[1];
        float d = length(v_view);
        float fog_factor = (fog_end - d) / (fog_end - fog_start);
        fog_factor = clamp(fog_factor, 0.0, 1.0);
        gl_FragColor.rgb = mix(fog_color, gl_FragColor.rgb, fog_factor);
        //gl_FragColor.r = fog_factor;
    }

    //gl_FragColor.rgb = vec3(0.5*N + 0.5);
}
