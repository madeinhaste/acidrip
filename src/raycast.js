import {vec3} from 'gl-matrix';

var v0 = vec3.create();
var v1 = vec3.create();
var v2 = vec3.create();

var edge1 = vec3.create();
var edge2 = vec3.create();

var pvec = vec3.create();
var tvec = vec3.create();
var qvec = vec3.create();

function vec3_load(out, dv, ptr) {
    // read 3x int16
    out[0] = dv.getInt16(ptr + 0, true);
    out[1] = dv.getInt16(ptr + 2, true);
    out[2] = dv.getInt16(ptr + 4, true);
}

/*
function test_ray_triangle(
    ray,        // {origin: vec3, direction: vec3}
    isect,      // out vec3 [u, v, t]
    tmd_obj     // TMDObject
) {
    var best_index = -1;
    var best_t = Infinity;

    var dv = new DataView(tmd_obj.vertex_array);
    var sp = 0;
    var vertex_stride = 24;
    var triangle_count = tmd_obj.vertex_count / 3;

    for (var index = 0; index < triangle_count; ++index) {
        vec3_load(v0, points, sp + 0);
        vec3_load(v1, points, sp + vertex_stride);
        vec3_load(v2, points, sp + 2*vertex_stride);
        sp += 3*vertex_stride;

        // muller-trombore ray-triangle intersection
        vec3.sub(edge1, v1, v0);
        vec3.sub(edge2, v2, v0);
        vec3.cross(pvec, ray.direction, edge2);

        var det = vec3.dot(edge1, pvec);
        if (det == 0.0)
            continue;

        var inv_det = 1 / det;
        vec3.sub(tvec, ray.origin, v0);
        var u = inv_det * vec3.dot(tvec, pvec);
        if (u < 0 || u > 1)
            continue;

        vec3.cross(qvec, tvec, edge1);
        var v = inv_det * vec3.dot(ray.direction, qvec);
        if (v < 0 || (u + v) > 1)
            continue;

        var t = inv_det * vec3.dot(edge2, qvec);
        if (0 <= t && t < best_t) {
            best_t = t;
            best_index = sp/3;

            if (isect) {
                isect.u = u;
                isect.v = v;
                isect.t = t;
            }
        }
    }

    return best_index;
}

return test_ray_triangle;
}());
*/

const EPSILON = 0.00001;
const NO_HIT = -1;

export function test_ray_triangle(
    ro, rd,
    v0, v1, v2)
{
    vec3.sub(edge1, v1, v0);
    vec3.sub(edge2, v2, v0);
    vec3.cross(pvec, rd, edge2);

    var det = vec3.dot(edge1, pvec);
    if (Math.abs(det) < EPSILON)
        return NO_HIT;

    var inv_det = 1 / det;
    vec3.sub(tvec, ro, v0);
    var u = inv_det * vec3.dot(tvec, pvec);
    if (u < 0 || u > 1)
        return NO_HIT;

    vec3.cross(qvec, tvec, edge1);
    var v = inv_det * vec3.dot(rd, qvec);
    if (v < 0 || (u + v) > 1)
        return NO_HIT;

    var t = inv_det * vec3.dot(edge2, qvec);
    return t;
}
