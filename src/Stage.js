import {TIX, TIX2} from './tix';
import {LBD} from './lbd';
import {fetch_binary, padl, modulo} from './utils';
import {test_ray_triangle} from './raycast';
import {vec3} from 'gl-matrix';
import msgpack from 'msgpack-lite';

function load_lbd(stage_id, lbd_index) {
    var url = `data/cdi/stg${padl(stage_id, 2)}/m${padl(lbd_index, 3)}.lbd`;
    return fetch_binary(url)
        .then(f => {
            var lbd = new LBD;
            lbd.read(f);
            return lbd;
        });
}

function load_tix(stage_id, tex_id='a') {
    var url = `data/cdi/stg${padl(stage_id, 2)}/tex${tex_id}.tix`;
    return fetch_binary(url)
        .then(f => {
            var tix = new TIX;
            tix.read(f);
            return tix;
        });
}

function load_tix2(stage_id, tex_id='a') {
    var url = `data/cdi/stg${padl(stage_id, 2)}/tex${tex_id}.msgpack`;
    return fetch_msgpack(url)
        .then(ob => {
            var tix = new TIX2;
            tix.read(ob);
            return tix;
        });
}

function fetch_msgpack(url) {
    return fetch(url)
        .then(r => r.arrayBuffer())
        .then(ab => {
            var b = new Uint8Array(ab);
            return msgpack.decode(b);
        });
}

export class Stage {
    constructor() {
        this.id = 0;
        this.name = '';
        this.lbds = [];
        this.lbd_count = 0;
        this.lbd_stride = 0;
        this.layout = 'v';
        this.tix = null;
    }

    get_tile(x, y) {
        var tx = Math.floor(x);
        var ty = Math.floor(y);

        var ly = Math.floor(ty / 20);
        tx += 10 * (ly % 2);

        var lx = Math.floor(tx / 20);

        if (lx < 0 || lx >= this.lbd_stride)
            return null;

        if (ly < 0 || ly >= (this.lbd_count / this.lbd_stride))
            return null;

        var lbd_index = ly * this.lbd_stride + lx;
        var lbd = this.lbds[lbd_index];
        if (!lbd)
            return null;

        var tile_index = (ty % 20) * 20 + (tx % 20);

        //console.log(x, y, lbd_index, tile_index);

        var tile = lbd.tiles[tile_index];
        console.assert(tile);

        var fx = x - Math.floor(x);
        var fy = y - Math.floor(y);
        var h = tile_raycast(lbd, tile, fx, fy);
        return [tile, h];
    }

    get_lbd_translation(out, lbd_index) {
        var lx = 0;
        var ly = 0;

        if (this.layout == 'h') {
            lx = lbd_index % this.lbd_stride;
            ly = Math.floor(lbd_index / this.lbd_stride);
            lx -= (ly % 2) * 0.5;
        }

        out[0] =  20 * lx;
        out[1] = -20 * ly;
        out[2] = 0;
    }

    load() {
        return new Promise(resolve => {
            console.assert(!this.lbds.length);
            console.assert(this.lbd_count);

            var todo = this.lbd_count + 1;
            function done() {
                if (--todo == 0)
                    resolve();
            }

            _.times(this.lbd_count, lbd_index => {
                load_lbd(this.id, lbd_index)
                    .then(lbd => {
                        this.lbds[lbd_index] = lbd;
                        done();
                    });
            });

            load_tix2(this.id, 'a')
                .then(tix => {
                    this.tix = tix;
                    // XXX maybe move texture mgmt to renderer
                    tix.update_texture();
                    done();
                });
        });
    }

    on_lbds_loaded() {
        console.log('LBDS loaded');
        return;

        var gridw = 10 * (2*this.lbd_stride + 1);
        var gridh = 20 * (this.lbd_count / this.lbd_stride);
        var grid = new Int32Array(gridw * gridh);

        for (var i = 0; i < this.lbd_count; ++i) {
            var lx = i % this.lbd_stride;
            var ly = Math.floor(i / this.lbd_stride);

            lx = 20*lx + 10*((ly+1) % 2);
            ly = 20*ly;

            var tiles = this.lbds[i].tiles;
            for (var j = 0; j < 400; ++j) {
                var tx = j % 20;
                var ty = Math.floor(j / 20);
                var gx = lx + tx;
                var gy = ly + ty;

                // flipy
                gy = gridh - gy - 1;

                var gi = gy * gridw + gx;
                grid[gi] = tiles[j].tmd_index;
            }
        }

        var line = [];
        for (var i = 0; i < gridw * gridh; ++i) {
            var val = grid[i];
            if (!val)
                val = '  ';
            else
                val = padl(val.toString(16), 2, ' ');

            line.push(val);

            if (((i + 1) % gridw) == 0) {
                var hdr = padl(Math.floor(i / gridw), 4) + ':';
                console.log(hdr, line.join(' '));
                line = [];
            }
        }

        console.log('loaded lbds');
    }
    
    unload() {
        // TODO
    }
}

export function load_stages() {
    return fetch('data/stages.json')
        .then(r => r.json())
        .then(data => {
            var stages = data.map(d => {
                var stage = new Stage;
                Object.assign(stage, {
                    id: d.id,
                    name: d.name,
                    layout: d.layout || 'v',
                    lbd_count: d.nlbds,
                    lbd_stride: d.columns || 0
                });
                return stage;
            });
            return stages;
        });
}

// lbd, tile: tile to test
// x, y: 0..1
var v0 = vec3.create();
var v1 = vec3.create();
var v2 = vec3.create();

// ray
var ro = vec3.create();
var rd = vec3.create();

function load_v(out, dv, ptr) {
    // transform to space
    var x = 0.5 + dv.getInt16(ptr + 0, true) / 2048;
    var y = 0.0 + dv.getInt16(ptr + 2, true) / 2048;
    var z = 0.5 + dv.getInt16(ptr + 4, true) / 2048;

    // rotate to opengl coords
    out[0] = x;
    out[1] = -y;
    out[2] = 1-z;
}

function vec3_str(v) {
    return `[${v[0].toFixed(3)}, ${v[1].toFixed(3)}, ${v[2].toFixed(3)}]`;
}

function tile_raycast(lbd, tile, x, y) {
    var tmd_object = lbd.tmd.objects[tile.tmd_index];
    if (!tmd_object)
        return 0;

    // setup ray
    var h = 10;
    vec3.set(ro, x, h, 1-y);
    vec3.set(rd, 0, -1, 0);

    // for each triangle of the tile
    var dv = new DataView(tmd_object.vertex_array.buffer);
    var sp = 0;
    var sp_end = tmd_object.vertex_array.byteLength;
    var stride = 24;
    var best_t = Infinity;

    console.log('tile_raycast:', (sp_end - sp)/(3*stride), 'triangles');
    console.log('  ro:', vec3_str(ro), ' rd:', vec3_str(rd));

    while (sp < sp_end) {
        // load a triangle
        load_v(v0, dv, sp + 0*stride);
        load_v(v1, dv, sp + 1*stride);
        load_v(v2, dv, sp + 2*stride);
        sp += 3 * stride;

        var t = test_ray_triangle(ro, rd, v0, v1, v2);
        console.log(vec3_str(v0), vec3_str(v1), vec3_str(v2), ' t:', t);

        if (t < 0)
            continue;

        if (t < best_t)
            best_t = t;
    }

    // return height or ???
    if (best_t >= 0) {
        h = ro[1] + best_t * rd[1];
    }
    console.log('best_t:', best_t, ' height:', h);

    return h;
}
