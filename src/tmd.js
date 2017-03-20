import {vec3} from 'gl-matrix';

export class TMD {
    constructor() {
        this.objects = [];
    }

    read(f) {
        // header
        var id = f.read_u32();
        console.assert(id === 0x41);
        var flags = f.read_u32();
        var nobjs = f.read_u32();
        var fixp = !!(flags & 1);

        // objects
        var top = fixp ? 0 : f.sp;
        for (var i = 0; i < nobjs; ++i) {
            var obj = new TMDObject;
            obj.read(f, top);
            obj.create_buffer();
            this.objects.push(obj);
        }
    }
}

export class TMDObject {
    constructor() {
        this.verts = [];
        this.norms = [];
        this.prims = [];

        this.vertex_array = null;
        this.vertex_buffer = null;
        this.vertex_count = 0;
        this.vertex_start = 0;
        this.opaque_count = 0;
    }

    read(f, top) {
        // header
        var vert_ptr = f.read_u32();
        var vert_count = f.read_u32();
        var norm_ptr = f.read_u32();
        var norm_count = f.read_u32();
        var prim_ptr = f.read_u32();
        var prim_count = f.read_u32();
        var scale = f.read_i32();

        f.push();

        // vertices
        f.seek(top + vert_ptr);
        for (var i = 0; i < vert_count; ++i) {
            this.verts.push(f.read_i16(), f.read_i16(), f.read_i16());
            f.skip(2);
        }

        // normals
        f.seek(top + norm_ptr);
        for (var i = 0; i < norm_count; ++i) {
            this.norms.push(f.read_i16(), f.read_i16(), f.read_i16());
            f.skip(2);
        }

        // primitives
        f.seek(top + prim_ptr);
        for (var i = 0; i < prim_count; ++i) {
            var prim = new TMDPrimitive;
            prim.read(f);
            this.prims.push(prim);
        }

        f.pop();
    }

    create_buffer() {
        var vertex_size = 24;
        var vertex_count = 0;
        var opaque_count = 0;
        this.prims.forEach(prim => {
            var c = (prim.nv === 4) ? 6 : 3;
            vertex_count += c;

            var is_opaque = !prim.abe;
            if (is_opaque)
                opaque_count += c;
        });
        this.vertex_count = vertex_count;
        this.opaque_count = opaque_count;

        this.vertex_count = opaque_count;

        var vertex_array = this.vertex_array = new Uint8Array(vertex_size * vertex_count);
        var out = new DataView(vertex_array.buffer);
        var dp = 0;

        var verts = this.verts;
        var norms = this.norms;

        function write_vertex(prim, index) {
            var vidx = prim.v[index];
            var vx = verts[3*vidx + 0];
            var vy = verts[3*vidx + 1];
            var vz = verts[3*vidx + 2];

            out.setInt16(dp + 0, vx, true);
            out.setInt16(dp + 2, vy, true);
            out.setInt16(dp + 4, vz, true);
            out.setInt16(dp + 6, 0, true);

            var nidx = prim.n[index];
            if (nidx !== 0xffff) {
                var nx = norms[3*nidx + 0];
                var ny = norms[3*nidx + 1];
                var nz = norms[3*nidx + 2];
            } else {
                var nx = 0;
                var ny = 0;
                var nz = 0;
            }

            out.setInt16(dp + 8, nx, true);
            out.setInt16(dp + 10, ny, true);
            out.setInt16(dp + 12, nz, true);
            out.setInt16(dp + 14, 0, true);

            var colr = prim.c[3*index + 0];
            var colg = prim.c[3*index + 1];
            var colb = prim.c[3*index + 2];
            var cola = 255;
            //var alpha = has_bit(prim.mode, 1);

            out.setUint8(dp + 16, colr, true);
            out.setUint8(dp + 17, colg, true);
            out.setUint8(dp + 18, colb, true);
            out.setUint8(dp + 19, cola, true);

            var texu = 0;
            var texv = 0;

            if (has_bit(prim.mode, 2)) {
                var texu = prim.t[2*index + 0];
                var texv = prim.t[2*index + 1];

                var tpage = prim.tpage;
                var tpx = (tpage & 15) << 7;
                var tpy = (((tpage & 16) >> 4) << 8) +
                          (((tpage & 0x800) >> 11) << 9);

                texu += tpx;
                texv += tpy;
            }

            out.setUint16(dp + 20, texu, true);
            out.setUint16(dp + 22, texv, true);

            dp += vertex_size;
            console.assert(dp <= vertex_array.length);
        }

        function write_prims(prims, opaque) {
            prims.forEach(prim => {
                var is_opaque = !prim.abe;
                if (is_opaque !== opaque)
                    return;

                write_vertex(prim, 0);
                write_vertex(prim, 1);
                write_vertex(prim, 2);

                if (prim.nv === 4) {
                    write_vertex(prim, 1);
                    write_vertex(prim, 3);
                    write_vertex(prim, 2);
                }
            });
        }

        write_prims(this.prims, true);
        write_prims(this.prims, false);

        // fix normals
        (function() {
            var dv = new DataView(vertex_array.buffer);
            var dp = 0;
            var dp_end = vertex_array.buffer.byteLength;

            var v0 = vec3.create();
            var v1 = vec3.create();
            var v2 = vec3.create();

            var n0 = vec3.create();
            var n1 = vec3.create();
            var n2 = vec3.create();

            var stride = vertex_size;

            function load_v(out, ptr) {
                out[0] = dv.getInt16(ptr + 0, true);
                out[1] = dv.getInt16(ptr + 2, true);
                out[2] = dv.getInt16(ptr + 4, true);
            }

            function clamp_i16(x) {
                x = Math.round(x);
                const MIN = -32768;
                const MAX = 32767;
                if (x < MIN) x = MIN;
                else if (x > MAX) x = MAX;
                return x;
            }

            function save_v(src, ptr) {
                var x = clamp_i16(src[0]);
                var y = clamp_i16(src[1]);
                var z = clamp_i16(src[2]);

                dv.setInt16(ptr + 0, x, true);
                dv.setInt16(ptr + 2, y, true);
                dv.setInt16(ptr + 4, z, true);

                //console.log(x, y, z);
            }

            function is_zero(src) {
                const EPS = 0.001;
                return vec3.sqrLen(src) < EPS;
            }

            while (dp < dp_end) {
                load_v(v0, dp + 0);
                load_v(v1, dp + stride);
                load_v(v2, dp + 2*stride);

                load_v(n0, dp + 8);
                load_v(n1, dp + stride + 8);
                load_v(n2, dp + 2*stride + 8);

                if (is_zero(n0) && is_zero(n1) && is_zero(n2)) {
                    // calculate face normal
                    vec3.sub(n1, v1, v0);
                    vec3.sub(n2, v2, v0);
                    vec3.normalize(n1, n1);
                    vec3.normalize(n2, n2);
                    vec3.cross(n0, n1, n2);
                    vec3.normalize(n0, n0);
                    vec3.scale(n0, n0, -4096);      // ??? XXX not sure which dir

                    save_v(n0, dp + 8);
                    save_v(n0, dp + stride + 8);
                    save_v(n0, dp + 2*stride + 8);
                }

                // next triangle
                dp += 3*stride;
            }
        }());
    }
}

export class TMDPrimitive {
    constructor() {
        this.flag = 0;
        this.mode = 0;
        this.cba = 0;
        this.tsb = 0;
        this.clut_xpos = 0;
        this.clut_ypos = 0;
        this.tpage = 0;
        this.abr = 0;
        this.tpf = 0;
        this.nv = 0;

        this.t = [];
        this.n = [];
        this.v = [];
        this.c = [];

        this.abe = false;
    }

    read(f) {
        // header
        this.olen = f.read_u8();
        this.ilen = f.read_u8();
        this.flag = f.read_u8();
        this.mode = f.read_u8();

        var LGT = has_bit(this.flag, 0);
        var FCE = has_bit(this.flag, 1);
        var GRD = has_bit(this.flag, 2);

        var TGE = has_bit(this.mode, 0);
        var ABE = has_bit(this.mode, 1);
        var TME = has_bit(this.mode, 2);
        var QUA = has_bit(this.mode, 3);
        var IIP = has_bit(this.mode, 4);

        this.abe = ABE;

        var nv = this.nv = QUA ? 4 : 3;

        var start = f.sp;

        // packet: texcoord
        if (TME) {
            for (var i = 0; i < nv; ++i) {
                var texu = f.read_u8();
                var texv = f.read_u8();
                var word = f.read_u16();
                if (i == 0) {
                    this.cba = word;
                    this.clut_xpos = (word & 63) << 4;
                    this.clut_ypos = (word >> 6);
                } else if (i == 1) {
                    this.tsb = word;
                    this.tpage = word & 0x1f;
                    this.abr = (word >> 5) & 3;
                    this.tpf = (word >> 7) & 3;
                    this.img_xpos = (this.tpage & 15) << 6;
                    this.img_ypos = ((this.tpage & 16) >> 4) << 8;
                }

                this.t.push(texu, texv);
            }
        } else {
            for (var i = 0; i < nv; ++i)
                this.t.push(0, 0);
        }

        // packet: color
        var colormode;
        if (LGT) {
            if (GRD || IIP)
                colormode = 2
            else
                colormode = 1
        } else {
            if (TME)
                colormode = 0
            else if (GRD)
                colormode = 2
            else
                colormode = 1
        }

        if (colormode === 0) {
            // no color
            for (var i = 0; i < nv; ++i)
                this.c.push(255, 255, 255);
        } else if (colormode === 1) {
            // flat color
            var colr = f.read_u8();
            var colg = f.read_u8();
            var colb = f.read_u8();
            f.skip(1);
            for (var i = 0; i < nv; ++i)
                this.c.push(colr, colg, colb);
        } else if (colormode === 2) {
            // gradient color
            for (var i = 0; i < nv; ++i) {
                var colr = f.read_u8();
                var colg = f.read_u8();
                var colb = f.read_u8();
                f.skip(1);
                this.c.push(colr, colg, colb);
            }
        }

        // packet: normal/vertex
        if (LGT) {
            // no normals
            var nidx = 0xffff;
            for (var i = 0; i < nv; ++i) {
                var vidx = f.read_u16();
                this.n.push(nidx);
                this.v.push(vidx);
            }
        } else if (IIP) {
            // per-vertex normals
            for (var i = 0; i < nv; ++i) {
                var nidx = f.read_u16();
                var vidx = f.read_u16();
                this.n.push(nidx);
                this.v.push(vidx);
            }
        } else {
            // face normal
            var nidx = f.read_u16();
            for (var i = 0; i < nv; ++i) {
                var vidx = f.read_u16();
                this.n.push(nidx);
                this.v.push(vidx);
            }
        }

        // pad by 4
        f.seek((f.sp + 3) & ~3);

        // check position matches ilen
        // XXX assuming file sp is word-aligned
        var word_count = (f.sp - start) / 4;
        console.assert(word_count === this.ilen);
    }
}

function has_bit(x, b) {
    return !!(x & (1<<b));
}
