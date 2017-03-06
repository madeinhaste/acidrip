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

// tmd.vertex //
void main() {
    vec3 P = position;
    P.y = -P.y;
    P.z = -P.z;

    P = (m_obj * vec4(P, 1.0)).xyz;

    v_view = normalize(view_pos - P);
    v_light = normalize(light_pos - P);
    v_position = P;
    v_color = color;
    v_normal = normal;
    v_texcoord = vec2(texcoord.x / 2048.0, texcoord.y / 512.0);

    gl_Position = m_vp * vec4(P, 1.0);
}

// tmd.fragment //
#extension GL_OES_standard_derivatives : enable

// magic normals
vec3 face_normal(vec3 pos) {
    vec3 fdx = dFdx(pos);
    vec3 fdy = dFdy(pos);
    return normalize(cross(fdx, fdy));
}

void main() {
    vec3 N = face_normal(v_position);
    vec3 V = normalize(v_view);
    vec3 L = normalize(v_light);
    vec3 H = normalize(L + V);

    float NdotL = max(0.0, dot(N, L));
    float NdotH = max(0.0, dot(N, H));
    //float Ka = 0.7;
    //float Ka = 0.25;
    float Ka = 0.45;
    float Kd = Ka  + NdotL;
    float Ks = pow(NdotH, 30.0);

    vec3 Cd = v_color;
    vec3 Cs = vec3(0.5);
    vec3 C = Kd * Cd + Ks * Cs;

    gl_FragColor = vec4(C, 1.0);
    //gl_FragColor.rgb = (v_normal + 1.0)*0.5;

    if (v_texcoord.x > 0.0) {
        //gl_FragColor.rgb = vec3(v_texcoord.xyz);
        vec4 Ct = texture2D(s_tix, v_texcoord.xy);
        if (Ct.a < 0.5) discard;
        gl_FragColor.rgb *= Ct.rgb;
    }
}
