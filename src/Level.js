import {padl} from './utils';
import msgpack from 'msgpack-lite';
import {vec3, mat4} from 'gl-matrix';
import {new_vertex_buffer, bind_vertex_buffer, get_program} from './webgl';
import {RAD_PER_DEG} from './utils';
import {test_ray_triangle} from './raycast';

const VERTEX_SIZE = 24;

const CHARACTERS = {
    barrel: 0,
    headless_woman: 1,
    dumpster: 2,
    dumpster_body: 3,
    hopskotch_girl: 4,
    corpse: 5,
    boat: 6,
    hanged_woman: 7,
    spaceship: 8,
    pulse: 9,
    kicker: 10,
    ghost: 11,
    gunman: 12,
    victim: 13,
    car: 14,
    sailor: 15,
    boat2: 16,
    plane: 17,
    boat3: 18,
};

function fetch_msgpack(url) {
    return fetch(url)
        .then(r => r.arrayBuffer())
        .then(ab => {
            var b = new Uint8Array(ab);
            return msgpack.decode(b);
        });
}

function alloc_buffer(size) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, size, gl.STATIC_DRAW);
    return buf;
}

const TEXTURE_W = 2048;
const TEXTURE_H = 512;

const CONVERT_5_TO_8_BIT = new Uint8Array([
       0,   8,  16,  25,  33,  41,  49,  58,
      66,  74,  82,  90,  99, 107, 115, 123,
     132, 140, 148, 156, 165, 173, 181, 189,
     197, 206, 214, 222, 230, 239, 247, 255
]);

function tile_to_image(tile) {
    var image = new ImageData(tile.w, tile.h);
    var pixels = image.data;
    var dp = 0;
    var sp = 0;
    for (var y = 0; y < tile.h; ++y) {
        for (var x = 0; x < tile.w; ++x) {
            var s = tile.data[sp++];
            var bits = tile.clut[s];

            pixels[dp + 0] = CONVERT_5_TO_8_BIT[bits & 0x1f];
            pixels[dp + 1] = CONVERT_5_TO_8_BIT[(bits >> 5) & 0x1f];
            pixels[dp + 2] = CONVERT_5_TO_8_BIT[(bits >> 10) & 0x1f];

            var alpha = bits & 0x8000;
            if ((bits & 0x7fff) === 0) {
                pixels[dp + 3] = alpha ? 255 : 0;
            } else {
                pixels[dp + 3] = alpha ? 128 : 255;
            }

            dp += 4;
        }
    }
    return image;
}

var anim_mat = mat4.create();
var mat = mat4.create();

class Draw {
    constructor(buffer, start, count, matrix) {
        this.buffer = buffer;
        this.start = start;
        this.count = count;
        this.matrix = mat4.clone(matrix);
    }
}

class DrawList {
    constructor() {
        this.draws = [];
        this.index = 0;
    }

    reset() {
        this.index = 0;
    }

    push(buffer, start, count, matrix) {
        var draw;
        if (this.index >= this.draws.length) {
            draw = new Draw(buffer, start, count, matrix);
            this.draws.push(draw);
        } else {
            draw = this.draws[this.index++];
            draw.buffer = buffer;
            draw.start = start;
            draw.count = count;
            mat4.copy(draw.matrix, matrix);
        }
    }
}

export class Level {
    constructor() {
        this.id = 0;
        this.name = '';
        this.map = null;
        this.tiles = [];
        this.models = [];
        this.buffers = [];
        this.characters = [];

        // gl stuff
        this.pgm = null;
        this.gl_buffers = [];
        this.bound_buffer_index = -1;
        this.texture = null;

        // render switches
        this.fog_enabled = false;

        this.ready = false;
        this.draw_opaque = true;
        this.time = 0.0;

        this.ghost = {
            pos: vec3.fromValues(61.39, 32.61, 0.0),
            dir: 0
        };

        // draw list
        this.draws = {
            opaque: [],
            translucent: []
        };
    }

    load(id) {
        var num = padl(id, 2);
        var url = `data/cdi/stg${num}/level${num}.msgpack`;
        return fetch_msgpack(url).then(data => {
            this.initialize(data);
            console.log(url);
            return this.load_texture('d');
        });
    }

    load_texture(version='a') {
        var num = padl(this.id, 2);
        var url = `data/cdi/stg${num}/tex${version}.msgpack`;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        return fetch_msgpack(url).then(data => {
            data.forEach(tile => {
                var image = tile_to_image(tile);
                gl.texSubImage2D(
                    gl.TEXTURE_2D, 0,
                    tile.x, tile.y, tile.w, tile.h,
                    gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(image.data));
            });
            console.log(url);
        });
    }

    initialize(data) {
        Object.assign(this, data);

        // shader
        this.pgm = get_program('tmd');

        // vertex buffers
        this.gl_buffers = _.map(this.buffers, src => {
            var b = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, b);
            gl.bufferData(gl.ARRAY_BUFFER, src, gl.STATIC_DRAW);
            return b;
        });

        // texture
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TEXTURE_W, TEXTURE_H, 0,
                      gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.ready = true;
    }

    bind_buffer(buffer_index) {
        if (buffer_index === this.bound_buffer_index)
            return;

        var buffer = this.gl_buffers[buffer_index];
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

        var pgm = this.pgm;
        pgm.vertexAttribPointer('position', 3, gl.SHORT, false, 24, 0);
        pgm.vertexAttribPointer('normal', 3, gl.SHORT, false, 24, 8);
        pgm.vertexAttribPointer('color', 3, gl.UNSIGNED_BYTE, true, 24, 16);
        pgm.vertexAttribPointer('texcoord', 2, gl.UNSIGNED_SHORT, false, 24, 20);

        this.bound_buffer_index = buffer_index;
    }

    _draw_model(model_index, mat) {
        var model = this.models[model_index];
        this.bind_buffer(model.buffer);
        this.pgm.uniformMatrix4fv('m_obj', mat);

        var oc = model.opaque_count;
        if (this.draw_opaque) {
            if (oc) gl.drawArrays(gl.TRIANGLES, model.start, oc);
        }
        else {
            var tc = model.count - oc;
            if (tc) gl.drawArrays(gl.TRIANGLES, model.start + oc, tc);
        }
    }

    draw_model(model_index, mat) {
        var model = this.models[model_index];
        var mat2 = mat4.clone(mat);

        var oc = model.opaque_count;
        if (oc) {
            this.draws.opaque.push({
                buffer: model.buffer,
                start: model.start,
                count: oc,
                mat: mat2
            });
        }

        var tc = model.count - oc;
        if (tc) {
            this.draws.translucent.push({
                buffer: model.buffer,
                start: model.start + oc,
                count: tc,
                mat: mat2
            });
        }

        /*
        this.draws.push({
            model: model_index,
            mat: mat4.clone(mat)
        });
        */
    }

    draw_models(draws) {
        draws.forEach(d => {
            this.bind_buffer(d.buffer);
            this.pgm.uniformMatrix4fv('m_obj', d.mat);
            gl.drawArrays(gl.TRIANGLES, d.start, d.count);
        });
    }

    draw_tile(tile_index, tx, ty, tz) {
        var tile = this.tiles[tile_index];

        const scale = 0.5/1024;
        mat4.identity(mat);
        mat4.translate(mat, mat, [tx + 0.5, tz - tile.height, -ty + 0.5]);
        mat4.scale(mat, mat, [scale, scale, scale]);
        mat4.rotateY(mat, mat, -0.5 * tile.rotate * Math.PI);

        this.draw_model(tile.model, mat);

        if (tile.next) {
            // draw further tiles in this location
            this.draw_tile(tile.next, tx, ty, tz);
        }
    }

    draw_character(ch_index, tx, ty, tz, rotate) {
        var now = performance.now();
        var t = Math.floor(now * 60 / 1000);

        var ch = this.characters[ch_index];
        var take = ch.takes[0];

        //tx = ch.lx;
        //ty = ch.ly;
        //tz = 0;
        //rotate = 0;

        //const scale = 0.5/1024;
        //const scale = 0.75/1024;
        const scale = 0.5/1024;

        //const scale = 1/512;
        mat4.identity(mat);
        mat4.translate(mat, mat, [tx + 0.5, tz, -ty + 0.5]);
        mat4.scale(mat, mat, [scale, scale, scale]);
        mat4.rotateY(mat, mat, -0.5 * rotate * Math.PI);

        take.parts.forEach(part => {
            var frame = Math.floor((t / take.resolution) % take.nframes);
            var sp = 16 * frame;
            for (var i = 0; i < 16; ++i)
                anim_mat[i] = part.mats[sp + i];

            mat4.multiply(anim_mat, mat, anim_mat);
            this.draw_model(part.model, anim_mat);
            //console.log(part.model, part.mats);
        });
    }

    draw(env) {
        if (!this.ready)
            return;

        this.time = performance.now() / 1000;

        // reset bound buffer
        this.bound_buffer_index = -1;

        var pgm = this.pgm.use();
        pgm.uniformMatrix4fv('m_vp', env.camera.mvp);
        pgm.uniform3fv('view_pos', env.camera.view_pos);
        pgm.uniform3fv('light_pos', env.light_pos);
        pgm.uniformSampler2D('s_tix', this.texture);    // XXX

        if (this.fog_enabled) {
            pgm.uniform3f('fog_color', 0.05, 0, 0.15);
            pgm.uniform2f('fog_range', 10, 40);
        } else {
            pgm.uniform2f('fog_range', 10000, 10000);
        }

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        // clear draws
        this.draws.opaque = [];
        this.draws.translucent = [];

        // setup draws
        this.draw2(env);

        $('#debug').text('' + this.draws.length);




        // draw opaque
        this.draw_models(this.draws.opaque);

        // translucent pass
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.depthMask(false);

        this.draw_models(this.draws.translucent);

        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }

    draw2(env) {
        var pgm = this.pgm;
        pgm.uniform1f('ambient', 0.75);

        var map_w = this.map.w;
        var map_h = this.map.h;
        var map_tiles = this.map.tiles;
        var tiles = this.tiles;
        var sp = 0;
        for (var ty = 0; ty < map_h; ++ty) {
            for (var tx = 0; tx < map_w; ++tx) {
                var tile_index = map_tiles[sp++];

                if (tile_index === 0) {
                    // empty tile
                    continue;
                }

                this.draw_tile(tile_index, tx, ty, 0);
            }
        }

        //this.draw_character(0, 50.49, 0.0, 38.5);
        //pgm.uniform1f('ambient', 2.50);
        pgm.uniform1f('ambient', 1.00);
        this.draw_character(CHARACTERS.corpse, 59.93, 38.0, 0.0, 3);
        this.draw_character(CHARACTERS.hopskotch_girl, 44.0, 25.0, 0.05, 0);
        this.draw_character(CHARACTERS.sailor, 77.30, 97.25, -0.015, 0);
        this.draw_character(CHARACTERS.headless_woman, 62.90, 8.90, 0.0, 2);
        this.draw_character(CHARACTERS.kicker, 91.10, 13.39, 0.0, 0.5);
        this.draw_character(CHARACTERS.hanged_woman, 37.80, 15.00, 0.0, 0);
        this.draw_character(CHARACTERS.plane, 77.30, 97.25, 0.0, 0);
        this.draw_character(CHARACTERS.car, 60.0, 85.0, 0, 0);
        
        this.draw_character(CHARACTERS.gunman, 93.00, 70.0, 0.0, 0);
        this.draw_character(CHARACTERS.victim, 93.00, 66.25, 0.0, 2);

        // boats
        var tx = 0.025 * this.time;
        this.draw_character(CHARACTERS.boat, 15.00, 64.85 - tx, 0.0, 0);

        this.draw_character(CHARACTERS.dumpster_body, 54.30, 28.71, 0.0, 0);



        var pos = this.ghost.pos;
        var dir = this.ghost.dir;
        this.draw_character(CHARACTERS.ghost, pos[0], pos[1], pos[2], dir);
    }

    get_tile(x, y, z) {
        var tx = Math.floor(x);
        var ty = Math.floor(y);
        var map_w = this.map.w;
        var map_h = this.map.h;

        if (tx < 0 || tx >= map_w || ty < 0 || ty >= map_h) {
            // off map
            return [null, 0];
        }

        var map_index = (ty + 1) * map_w + tx;
        var tile_index = this.map.tiles[map_index];
        if (tile_index === 0)
            return [null, 0];

        var tile = this.tiles[tile_index];
        //console.log('map_index:', x, y, map_index, tile);
        console.assert(tile);

        var fx = x - tx;
        var fy = y - ty;
        var h = tile_raycast(this, tile, fx, fy, z);
        return [tile, h];
    }
}

// lbd, tile: tile to test
// x, y: 0..1
var v0 = vec3.create();
var v1 = vec3.create();
var v2 = vec3.create();

// ray
var ro = vec3.create();
var rd = vec3.create();

var tile_mat = mat4.create();

function load_v(out, dv, ptr) {
    out[0] =  dv.getInt16(ptr + 0, true);
    out[1] = -dv.getInt16(ptr + 2, true);
    out[2] = -dv.getInt16(ptr + 4, true);
    vec3.transformMat4(out, out, tile_mat);
}

function vec3_str(v) {
    return `[${v[0].toFixed(3)}, ${v[1].toFixed(3)}, ${v[2].toFixed(3)}]`;
}

function tile_raycast(level, tile, x, y, h) {
    var model = level.models[tile.model];
    var buffer = level.buffers[model.buffer];

    const scale = 0.5/1024;
    var mat = tile_mat;
    mat4.identity(mat);
    mat4.translate(mat, mat, [0.5, 0.0, 0.5]);
    mat4.scale(mat, mat, [scale, scale, scale]);
    mat4.rotateY(mat, mat, -0.5 * tile.rotate * Math.PI);

    // setup ray
    vec3.set(ro, x, h, 1-y);
    vec3.set(rd, 0, -1, 0);

    // for each triangle of the tile
    var dv = new DataView(buffer.buffer);
    var stride = VERTEX_SIZE;
    var sp = stride * model.start;
    var sp_end = sp + stride * model.count;
    var best_t = Infinity;

    //console.log('tile_raycast:', (sp_end - sp)/(3*stride), 'triangles');
    //console.log('  ro:', vec3_str(ro), ' rd:', vec3_str(rd));

    while (sp < sp_end) {
        // load a triangle
        load_v(v0, dv, sp + 0*stride);
        load_v(v1, dv, sp + 1*stride);
        load_v(v2, dv, sp + 2*stride);
        sp += 3 * stride;

        var t = test_ray_triangle(ro, rd, v0, v1, v2);
        //console.log(vec3_str(v0), vec3_str(v1), vec3_str(v2), ' t:', t);

        if (t < 0)
            continue;

        if (t < best_t)
            best_t = t;
    }

    // return height or ???
    if (best_t >= 0) {
        h = ro[1] + best_t * rd[1];
    }
    //console.log('best_t:', best_t, ' height:', h);

    return h;
}
