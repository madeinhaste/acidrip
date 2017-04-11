import {padl} from './utils';
import {vec3, mat4} from 'gl-matrix';
import {new_vertex_buffer, bind_vertex_buffer, get_program} from './webgl';
import {RAD_PER_DEG} from './utils';
import {test_ray_triangle} from './raycast';
import {fetch_msgpack, fetch_msgpack_gz, base64_encode, base64_decode} from './utils';
import {simplex2} from './noise';
import {rasterize} from './rasterize';

var tmp = vec3.create();
function calc_frustum_vertex(out, dp, imvp, x, z) {
    tmp[0] = x;
    tmp[1] = 0;
    tmp[2] = z;

    vec3.transformMat4(tmp, tmp, imvp);

    out[dp + 0] = tmp[0];
    out[dp + 1] = -tmp[2];
}

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

function alloc_buffer(size) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, size, gl.STATIC_DRAW);
    return buf;
}

function create_texture(format, w, h) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, format, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

const TEXTURE_W = 2048;
const TEXTURE_H = 512;

const CONVERT_5_TO_8_BIT = new Uint8Array([
       0,   8,  16,  25,  33,  41,  49,  58,
      66,  74,  82,  90,  99, 107, 115, 123,
     132, 140, 148, 156, 165, 173, 181, 189,
     197, 206, 214, 222, 230, 239, 247, 255
]);

function tile_to_image_data(tile) {
    var pixels = new Uint8Array(4 * tile.w * tile.h);
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
    return pixels;
}

var anim_mat = mat4.create();
var mat = mat4.create();
var ambient = vec3.create();

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

    clear() {
        this.index = 0;
        this.created = 0;
    }

    push(buffer, start, count, matrix) {
        var draw;
        if (this.index >= this.draws.length) {
            draw = new Draw(buffer, start, count, matrix);
            ++this.created;
            this.draws.push(draw);
            this.index = this.draws.length;
        } else {
            draw = this.draws[this.index++];
            draw.buffer = buffer;
            draw.start = start;
            draw.count = count;
            mat4.copy(draw.matrix, matrix);
        }
    }
}

const AREA_COLORS = {
    0: [0, 0, 0],
    1: [255, 0, 0],         // red:         collide

    2: [0, 255, 0],         // green:       
    3: [0, 0, 255],         // blue:
    4: [255, 255, 0],       // yellow:
    5: [255, 0, 255],       // magenta:
    6: [0, 255, 255],       // cyan:
    7: [255, 128, 0],       // orange:
    8: [0, 255, 128],       // teal:
};

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
        this.fog_enabled = true;

        this.ready = false;
        this.time = 0.0;

        this.ghost = {
            pos: vec3.fromValues(61.39, 32.61, 0.0),
            dir: 0,
            active: false
        };

        this.plane_start = 0;

        // draw list
        this.draws = {
            opaque: new DrawList,
            translucent: new DrawList,
        };

        // quad buffer for tiles
        this.quad = null;
        this.loop = null;

        // areas
        this.areas_texture = null;
        this.areas_lut = null;

        this.save_areas_db = _.debounce(() => this.save_areas_to_local_storage(), 1000);
        this.draw_debug = false;
        this.flicker = false;

        // player
        this.player = null;
        this.frustum_quad = new Float32Array(8);
        this.use_frustum_tiles = true;
    }

    save_areas_to_local_storage() {
        var w = this.map.w;
        var h = this.map.h;
        var n = w * h;
        var out = new Uint8Array(n);
        var tiles = this.tiles;
        for (var i = 0; i < n; ++i) {
            var idx = this.map.tiles[i];
            var tile = tiles[idx];
            out[i] = tile ? tile.area : 0;
        }
        var s = base64_encode(out);
        localStorage.setItem('level.areas', s);
        console.log('save_areas:', s.length);
    }

    load_areas_from_local_storage(s) {
        if (!s)
            s = localStorage.getItem('level.areas');

        if (!s)
            return;

        var src = base64_decode(s, Uint8Array);
        console.log('load_areas:', src.length);

        var w = this.map.w;
        var h = this.map.h;
        var n = w * h;
        var tiles = this.tiles;
        for (var i = 0; i < n; ++i) {
            var idx = this.map.tiles[i];
            var tile = tiles[idx];
            if (tile)
                tile.area = src[i];
        }

        this.update_areas_texture();
    }

    toggle_area(x, y, area) {
        var tx = Math.floor(x);
        var ty = Math.floor(y);
        if (tx < 0 || tx >= this.map.w)
            return;
        if (ty < 0 || ty >= this.map.h)
            return;
        var idx = ty * this.map.w + tx;

        var tile_index = this.map.tiles[idx];
        var tile = this.tiles[tile_index];

        if (tile) {
            tile.area = (tile.area === area) ? 0 : area;
            this.update_areas_texture();
            this.save_areas_db();
        }
    }

    update_areas_texture() {
        var w = this.map.w;
        var h = this.map.h;

        if (!this.areas_texture) {
            console.log('level.update_areas_texture: creating debug textures');

            this.areas_lut = create_texture(gl.RGBA, 256, 1);
            var lut = new Uint8Array(4 * 256);
            _.each(AREA_COLORS, (col, idx) => {
                var dp = 4 * idx;
                lut[dp + 0] = col[0];
                lut[dp + 1] = col[1];
                lut[dp + 2] = col[2];
                lut[dp + 3] = 255;
            });
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1,
                             gl.RGBA, gl.UNSIGNED_BYTE, lut);

            this.areas_texture = create_texture(gl.RGBA, w, h);
        }

        var data = new Uint8Array(4 * w * h);
        var tiles = this.tiles;
        var n = w * h;
        var dp = 0;
        for (var i = 0; i < n; ++i) {
            var idx = this.map.tiles[i];
            var tile = tiles[idx];
            data[dp + 0] = tile ? tile.area : 0;
            data[dp + 1] = 0;
            data[dp + 2] = 0;
            data[dp + 3] = 0;
            dp += 4;
        }

        gl.bindTexture(gl.TEXTURE_2D, this.areas_texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }

    load(id) {
        var url = 'data/lvl5.mpz';
        //console.log('level:load');

        // load level & textures in parallel
        return Promise.all([
            fetch_msgpack_gz(url).then(data => {
                //console.log('level:load .. fetched msgpack gz:', url);
                this.initialize(data);
            }),
            this.load_texture('c')
        ]);
    }

    load_texture(version='a') {
        if (!this.texture)
            this.texture = create_texture(gl.RGBA, TEXTURE_W, TEXTURE_H);

        var url = `data/tex5${version}.mpz`;

        return fetch_msgpack_gz(url).then(data => {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
            data.forEach(tile => {
                var pixels = tile_to_image_data(tile);
                gl.texSubImage2D(
                    gl.TEXTURE_2D, 0,
                    tile.x, tile.y, tile.w, tile.h,
                    gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            });
        });
    }

    initialize(data) {
        _.assign(this, data);
        //console.log('level:initialize');

        // shader
        this.pgm = get_program('tmd');
        //console.log('level:initialize: got program');

        // vertex buffers
        this.gl_buffers = _.map(this.buffers, src => {
            var b = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, b);
            gl.bufferData(gl.ARRAY_BUFFER, src, gl.STATIC_DRAW);
            return b;
        });
        //console.log('level:initialize: init buffers');

        // maybe load areas ???
        //this.load_areas_from_local_storage();

        this.ready = true;
        //console.log('level:initialize: ready');
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

    // construct drawlist
    draw_model(model_index, mat) {
        var model = this.models[model_index];
        var oc = model.opaque_count;

        if (oc) {
            this.draws.opaque.push(model.buffer, model.start, oc, mat);
        }

        var tc = model.count - oc;
        if (tc) {
            this.draws.translucent.push(model.buffer, model.start + oc, tc, mat);
        }
    }

    // dispatch drawlist
    draw_models(drawlist) {
        var pgm = this.pgm;
        var draws = drawlist.draws;
        var count = drawlist.index;
        for (var i = 0; i < count; ++i) {
            var d = draws[i];
            this.bind_buffer(d.buffer);
            pgm.uniformMatrix4fv('m_obj', d.matrix);
            gl.drawArrays(gl.TRIANGLES, d.start, d.count);
        }
    }

    draw_tile(tile_index, tx, ty, tz) {
        var tile = this.tiles[tile_index];

        const scale = 0.5/1024;
        mat4.identity(mat);
        mat4.translate(mat, mat, [
            tx + 0.5,
            tz - tile.height,
            -(ty + 0.5)
        ]);
        mat4.scale(mat, mat, [scale, scale, scale]);
        mat4.rotateY(mat, mat, -0.5 * tile.rotate * Math.PI);

        this.draw_model(tile.model, mat);

        if (tile.next) {
            // draw further tiles in this location
            this.draw_tile(tile.next, tx, ty, tz);
        }
    }

    draw_character(ch_index, tx, ty, tz, scale, rotate, animate=false) {
        // FIXME
        ty += 1;

        var now = performance.now();

        if (ch_index == CHARACTERS.plane) {
            if (!this.plane_start)
                return;
            now = now - this.plane_start;
            if (now > 4000)
                return;
        }

        var t = Math.floor(now * 60 / 1000);
        var ch = this.characters[ch_index];
        var take = ch.takes[0];

        //tx = ch.lx;
        //ty = ch.ly;
        //tz = 0;
        //rotate = 0;

        //const scale = 0.5/1024;
        //const scale = 0.75/1024;
        //const scale = 0.5/1024;
        scale *= 0.5/1024;

        //const scale = 1/512;
        mat4.identity(mat);
        mat4.translate(mat, mat, [tx + 0.5, tz, -ty + 0.5]);
        mat4.scale(mat, mat, [scale, scale, scale]);
        mat4.rotateY(mat, mat, -0.5 * rotate * Math.PI);

        take.parts.forEach(part => {
            var frame = 0;
            
            if (animate) {
                frame = Math.floor((t / take.resolution) % take.nframes);
            }

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

        // calc frustum
        this.calc_frustum();

        this.time = performance.now() / 1000;

        // reset bound buffer
        this.bound_buffer_index = -1;

        var pgm = this.pgm.use();
        pgm.uniformMatrix4fv('m_vp', env.camera.mvp);
        pgm.uniform3fv('view_pos', env.camera.view_pos);
        pgm.uniform3fv('light_pos', env.light_pos);
        pgm.uniformSampler2D('s_tix', this.texture);    // XXX

        if (this.fog_enabled) {
            var fog_end = env.camera.far;
            pgm.uniform3f('fog_color', 0.05, 0, 0.15);
            pgm.uniform2f('fog_range', 0.5*fog_end, fog_end);
        } else {
            pgm.uniform2f('fog_range', 10000, 10000);
        }

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        // clear draws
        //_.each(this.draws, dl => { dl.clear(); });

        this.draws.opaque.clear();
        this.draws.translucent.clear();

        // setup draws
        this.draw2(env);

        vec3.set(ambient, 0.75, 0.75, 0.75);

        if (this.flicker) {
            var time = performance.now() / 1000;
            var f0 = 0.850*(0.5 + 0.5*simplex2(time, 0.3123));
            var f1 = 0.500*(0.5 + 0.5*simplex2(2*time, 0.3123));
            var f2 = 1.000*(0.5 + 0.5*simplex2(8*time, 0.3123));

            vec3.scaleAndAdd(ambient, ambient, [1, 0.9, 0.5], 0.1 * f2);

            vec3.scaleAndAdd(ambient, ambient, [1, 0.2, 0.5], 0.2 * f1);
            vec3.scaleAndAdd(ambient, ambient, [1, 0.1, 0.0], 0.7 * f0);
        }
        pgm.uniform3fv('ambient', ambient);

        //$('#debug').text(`op: ${this.draws.opaque.index}  tl: ${this.draws.translucent.index}`);

        // draw opaque
        this.draw_models(this.draws.opaque);

        // translucent pass
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.depthMask(false);

        this.draw_models(this.draws.translucent);

        // debug tiles
        if (this.draw_debug) {
            this.draw_tiles_debug(env);
            this.draw_frustum(env);
        }

        gl.depthMask(true);
        gl.disable(gl.BLEND);

        // _.each(this.draws, (dl, k) => {
        //     console.log(k, 'cap:', dl.draws.length, ' len:', dl.index, ' cre:', dl.created);
        // });
    }
    
    calc_frustum() {
        if (!this.player)
            return;

        // project frustum quad
        var imvp = this.player.inverse_mvp;
        var quad = this.frustum_quad;

        calc_frustum_vertex(quad, 0, imvp, -1, -1);
        calc_frustum_vertex(quad, 2, imvp,  1, -1);
        calc_frustum_vertex(quad, 4, imvp,  1,  1);
        calc_frustum_vertex(quad, 6, imvp, -1,  1);
    }
    
    draw_frustum(env) {
        if (!this.loop) {
            this.loop = new_vertex_buffer(new Float32Array([ -1, -1, 0, 1, -1, 0, 1,  1, 0, -1,  1, 0, ]));
        }

        if (!this.player)
            return;

        mat4.identity(mat);
        mat4.rotateX(mat, mat, -0.5*Math.PI);
        mat4.multiply(mat, env.camera.mvp, mat);

        var pgm = get_program('simple').use();

        // draw the frustum quad

        pgm.uniformMatrix4fv('mvp', mat);
        pgm.uniform4f('color', 1, 1, 0, 1);

        bind_vertex_buffer(this.loop);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.frustum_quad);
        pgm.vertexAttribPointer('position', 2, gl.FLOAT, false, 0, 0);

        gl.disable(gl.DEPTH_TEST);
        gl.drawArrays(gl.LINE_LOOP, 0, 4);

        // draw the visible tiles
        pgm.uniform4f('color', 0, 1, 1, 0.25);
        bind_vertex_buffer(this.quad);
        pgm.vertexAttribPointer('position', 2, gl.FLOAT, false, 0, 0);

        rasterize(this.frustum_quad, (tx, ty) => {
            mat4.identity(mat);
            mat4.translate(mat, mat, [tx, 0, -ty]);
            mat4.rotateX(mat, mat, -0.5 * Math.PI);
            mat4.multiply(mat, env.camera.mvp, mat);
            pgm.uniformMatrix4fv('mvp', mat);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });
    }

    draw_tiles_debug(env) {
        if (!this.areas_texture) {
            this.update_areas_texture();
        }

        var pgm = get_program('tiles').use();
        pgm.uniformMatrix4fv('m_vp', env.camera.mvp);
        pgm.uniform2f('size', this.map.w, this.map.h);
        pgm.uniform4f('color', 1, 1, 1, 0.1);
        pgm.uniformSampler2D('s_map', this.areas_texture);
        pgm.uniformSampler2D('s_lut', this.areas_lut);

        if (!this.quad) {
            this.quad = new_vertex_buffer(new Float32Array([ 0, 0, 1, 0, 0, 1, 1, 1 ]));
        }

        bind_vertex_buffer(this.quad);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);
        gl.disable(gl.DEPTH_TEST);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    draw2(env) {
        var pgm = this.pgm;
        var map_w = this.map.w;
        var map_h = this.map.h;
        var map_tiles = this.map.tiles;
        var tiles = this.tiles;

        //var use_frustum_tiles = this.use_frustum_tiles;
        //var use_frustum_tiles = !this.draw_tiles_debug;
        var use_frustum_tiles = true;
        if (this.draw_debug) {
            use_frustum_tiles = false;
        }

        if (!use_frustum_tiles) {
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
        } else {
            rasterize(this.frustum_quad, (tx, ty) => {
                if (tx < 0 || tx >= map_w || ty < 0 || ty >= map_h) {
                    // out of bounds
                    return;
                }

                var map_index = ty * map_w + tx;
                var tile_index = map_tiles[map_index];

                if (tile_index === 0) {
                    // empty tile
                    return;
                }

                this.draw_tile(tile_index, tx, ty, 0);
            });
        }

        // --- characters ---

        this.draw_character(CHARACTERS.corpse, 59.93, 38.0, 0.0, 1.5, 3);
        this.draw_character(CHARACTERS.hopskotch_girl, 44.0, 25.0, 0.05, 1, 0, true);
        this.draw_character(CHARACTERS.sailor, 77.30, 97.25, -0.015, 1, 0);
        this.draw_character(CHARACTERS.headless_woman, 62.90, 8.90, 0.0, 1, 2);

        // woman2
        //this.draw_character(CHARACTERS.headless_woman, 85.3, 65.2, 0.0, 1.0, 0.2, false);

        // kicker
        this.draw_character(CHARACTERS.kicker, 91.10, 13.39, 0.0, 1, 1.2, true);
        this.draw_character(CHARACTERS.corpse, 91.54, 9.33, 0.0, 1, -0.5)
        this.draw_character(CHARACTERS.dumpster, 92.00, 10.00, 0.0, 1, 0.5);

        //this.draw_character(CHARACTERS.hanged_woman, 37.80, 15.00, 0.0, 1, 0, true);
        this.draw_character(CHARACTERS.plane, 77.30, 97.25, 0.0, 1, 0, true);
        this.draw_character(CHARACTERS.car, 60.0, 85.0, 0, 1, 0);
        
        this.draw_character(CHARACTERS.gunman, 93.00, 70.0, 0.0, 1, 0);
        this.draw_character(CHARACTERS.victim, 93.00, 66.25, 0.0, 1, 2);

        // boats
        var tx = 0.025 * this.time;
        this.draw_character(CHARACTERS.boat, 13.50, 64.85 - tx, 0.0, 1, 0, true);

        this.draw_character(CHARACTERS.dumpster_body, 54.30, 28.71, 0.0, 1, 0);



        var pos = this.ghost.pos;
        var dir = this.ghost.dir;
        this.draw_character(CHARACTERS.ghost, pos[0], pos[1], pos[2], 1, dir, true);
    }

    get_tile(x, y, z) {
        var tx = Math.floor(x);
        var ty = Math.floor(y);
        var map_w = this.map.w;
        var map_h = this.map.h;

        if (tx < 0 || tx >= map_w || ty < 0 || ty >= map_h) {
            // off map
            return [null, 0, 0];
        }

        var map_index = ty * map_w + tx;
        var tile_index = this.map.tiles[map_index];
        if (tile_index === 0)
            return [null, 0, 0];

        var tile = this.tiles[tile_index];
        //console.log('map_index:', x, y, map_index, tile);
        console.assert(tile);

        var fx = x - tx;
        var fy = y - ty;
        var h = tile_raycast(this, tile, fx, fy, z);

        return [tile, h];

        //var area = this.areas[4 * map_index];
        //return [tile, h, area];
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
