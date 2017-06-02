import {vec3} from 'gl-matrix';
import {each_line, clamp} from './utils';

function parse_OBJ(text) {

    function iter_OBJ(text, callback) {
        each_line(text, function(line) {
            line = line.trim();
            if (line[0] == '#') return;
            var bits = line.split(/\s+/);
            if (bits.length) callback(bits);
        });
    }

    function process_OBJ(text) {
        var v = vec3.create();
        var vi = [0, 0, 0];

        var pos_index_start = 0;
        var nor_index_start = 0;
        var tex_index_start = 0;

        function parse_vertex_attrib(out, bits) {
            for (var i = 1; i < bits.length; ++i)
                out[i - 1] = parseFloat(bits[i]);
        }

        function parse_face_indices(out, str) {
            var e = str.split('/');

            out[0] = parseInt(e[0]);
            out[1] = out[2] = 0;

            if (e.length == 2) {
                out[1] = parseInt(e[1]);
            } else if (e.length == 3) {
                if (e[1]) out[1] = parseInt(e[1]);
                out[2] = parseInt(e[2]);
            }

            --out[0];
            --out[1];
            --out[2];

            return out;
        }

        function OBJ_Object(name) {
            this.name = name;
            this.pos = [];
            this.nor = [];
            this.tex = [];
            this.pos_index = [];
            this.nor_index = [];
            this.tex_index = [];
        }

        var data = null;
        var objs = [];

        iter_OBJ(text, function(bits) {
            var cmd = bits[0];

            if (cmd == 'o') {
                if (data) {
                    pos_index_start = data.pos.length / 3;
                    nor_index_start = data.nor.length / 3;
                    tex_index_start = data.tex.length / 2;
                }

                data = new OBJ_Object(bits[1]);
                objs.push(data);
            }

            if (cmd == 'v') {
                parse_vertex_attrib(v, bits);
                data.pos.push(v[0], v[1], v[2]);
            }

            if (cmd == 'vt') {
                parse_vertex_attrib(v, bits);
                data.tex.push(v[0], v[1]);
            }

            if (cmd == 'vn') {
                parse_vertex_attrib(v, bits);
                data.nor.push(v[0], v[1], v[2]);
            }

            if (cmd == 'f') {
                var nsides = bits.length - 1;
                console.assert(nsides == 3);
                for (var i = 0; i < nsides; ++i) {
                    parse_face_indices(vi, bits[i + 1]);
                    if (vi[0] >= 0) data.pos_index.push(vi[0] - pos_index_start);
                    if (vi[1] >= 0) data.tex_index.push(vi[1] - tex_index_start);
                    if (vi[2] >= 0) data.nor_index.push(vi[2] - nor_index_start);
                }
            }
        });

        return objs;
    }

    return process_OBJ(text);
}

function obj_to_tmd(obj, texpage) {
    const vertex_count = obj.pos_index.length;
    const vertex_size = 24;

    var vertex_array = this.vertex_array = new Uint8Array(vertex_size * vertex_count);
    var opaque_count = vertex_count;

    var out = new DataView(vertex_array.buffer);
    var dp = 0;

    const SHORT_MIN = -32768;
    const SHORT_MAX =  32767;

    function clamp_short(x) {
        return ~~clamp(x, SHORT_MIN, SHORT_MAX);
    }

    console.log(obj.pos.length);
    console.log(obj.nor.length);
    console.log(obj.tex.length);

    console.log(obj.pos_index.length);
    console.log(obj.nor_index.length);
    console.log(obj.tex_index.length);

    console.log(obj.pos_index);

    var dp = 0;
    for (var i = 0; i < vertex_count; ++i) {
        var pos_sp = 3 * obj.pos_index[i];
        var nor_sp = 3 * obj.nor_index[i];
        var tex_sp = 2 * obj.tex_index[i];

        console.assert((pos_sp + 3) <= obj.pos.length);

        var vx = obj.pos[pos_sp + 0];
        var vy = obj.pos[pos_sp + 1];
        var vz = obj.pos[pos_sp + 2];
        console.log(vx, vy, vz);

        var POS_SCALE = 1024.0 / 3.0;
        vx = clamp_short(-vx * POS_SCALE);
        vy = clamp_short(-vy * POS_SCALE);
        vz = clamp_short(vz * POS_SCALE);

        out.setInt16(dp + 0, vx, true);
        out.setInt16(dp + 2, vy, true);
        out.setInt16(dp + 4, vz, true);
        out.setInt16(dp + 6, 0, true);

        var nx = obj.nor[nor_sp + 0];
        var ny = obj.nor[nor_sp + 1];
        var nz = obj.nor[nor_sp + 2];

        var NOR_SCALE = 4096.0 / 1.0;
        nx = clamp_short(-nx * NOR_SCALE);
        ny = clamp_short(-ny * NOR_SCALE);
        nz = clamp_short(nz * NOR_SCALE);

        out.setInt16(dp + 8, vx, true);
        out.setInt16(dp + 10, vy, true);
        out.setInt16(dp + 12, vz, true);
        out.setInt16(dp + 14, 0, true);

        // color
        var COL_BASE = 128;
        out.setUint8(dp + 16, COL_BASE, true);
        out.setUint8(dp + 17, COL_BASE, true);
        out.setUint8(dp + 18, COL_BASE, true);
        out.setUint8(dp + 19, 255, true);

        // texture
        var texu = 128 * (texpage[0] + obj.tex[tex_sp + 0]);
        var texv = 128 * (texpage[1] + obj.tex[tex_sp + 1]);
        //var TEX_SCALE = SHORT_MAX / 1.0;
        texu = clamp_short(texu);
        texv = clamp_short(texv);

        //texu = texv = 0.0;

        out.setUint16(dp + 20, texu, true);
        out.setUint16(dp + 22, texv, true);

        dp += vertex_size;
        console.assert(dp <= vertex_array.length);
    }
    console.log('v:', vertex_array.length);

    return {
        vertex_array,
        opaque_count
    };
}

export function load_obj(text) {
    var objs = parse_OBJ(text);
    var obj_grass = obj_to_tmd(objs[0], [2, 0]);
    var obj_stone = obj_to_tmd(objs[1], [2, 1]);

    var vertex_array = new Uint8Array(
        obj_stone.vertex_array.length +
        obj_grass.vertex_array.length);
    vertex_array.set(obj_stone.vertex_array, 0);
    vertex_array.set(obj_grass.vertex_array, obj_stone.vertex_array.length);
    var opaque_count = obj_stone.vertex_array.length / 24;

    return {
        vertex_array,
        opaque_count
    };
}
