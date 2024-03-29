import {LBD} from './src/lbd';
import {BinaryReader, padl} from './src/utils';
import {load_obj} from './src/obj';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var msgpack = require('msgpack-lite');
var filesize = require('file-size');
var pako = require('pako');

function load_lbd(filepath) {
    var buf = fs.readFileSync(filepath);
    var f = new BinaryReader(buf.buffer);
    var lbd = new LBD;
    lbd.read(f);
    return lbd;
}

function load_areas(filepath) {
    var str = fs.readFileSync(filepath, 'utf8');
    var buf = new Buffer(str, 'base64');
    return buf;
}

var stage_index = 5;
var stages = require('./stages.json');
var stage = stages[stage_index];
var stage_path = `./cdi/stg${padl(stage_index, 2)}`;

var level = {
    id: stage.id,
    name: stage.name,
    map: {
        w: 0,
        h: 0,
        tiles: []
    },
    tiles: [],
    models: [],
    buffers: [],
    characters: [],
};

console.assert(stage.layout == 'h');

var map_w = level.map.w = 10 * (2*stage.columns + 1);
var map_h = level.map.h = 20 * (stage.nlbds / stage.columns);
console.log('map:', map_w * map_h);

level.map.tiles = new Uint32Array(map_w * map_h);

var areas = load_areas('./level.areas.txt');
console.log('areas:', areas.length);

const VERTEX_BUFFER_SIZE = 1 << 20; // 1MB
const VERTEX_SIZE = 24;

class VertexBuffer {
    constructor(size=VERTEX_BUFFER_SIZE) {
        this.buffer = new Uint8Array(size);
        this.size = size;
        this.dp = 0;
    }

    add_array(src) {
        if (this.dp + src.length > this.size)
            return -1;

        this.buffer.set(src, this.dp);
        var start = this.dp;
        this.dp += src.length;
        return start;
    }

    trim() {
        var b = 10; // 1K
        var n = (1 << b) - 1;
        var s = (this.dp + n) & ~n;
        console.assert(s <= this.size);
        this.buffer = this.buffer.slice(0, s);
    }
}

class VertexBufferList {
    constructor() {
        this.buffers = [];
    }

    add_buffer() {
        var buffer = new VertexBuffer;
        this.buffers.push(buffer);
        return buffer;
    }

    get_buffer_for_size(size) {
        var buffer;
        if (this.buffers.length) {
            buffer = this.buffers[this.buffers.length - 1];
            if (buffer.dp + size <= buffer.size)
                return buffer;
        }

        buffer = this.add_buffer();
        console.assert(size <= buffer.size );
        return buffer;
    }

    add_array(src) {
        var buffer = this.get_buffer_for_size(src.length);
        var start = buffer.add_array(src);
        console.assert(start >= 0);

        var buffer_index = this.buffers.indexOf(buffer);
        console.assert(buffer_index >= 0);

        return {
            buffer: buffer_index,
            start: start / VERTEX_SIZE,
            count: src.length / VERTEX_SIZE
        };
    }
}

var buffers = new VertexBufferList;

function add_model(tmd_object) {
    var o = buffers.add_array(tmd_object.vertex_array);
    o.opaque_count = tmd_object.opaque_count;
    var model_index = level.models.length;
    level.models.push(o);
    return model_index;
}

function add_character(mom, lx, ly) {
    // XXX maybe add lbd_index/tx.ty
    var ch = {
        lx: ly,
        ly: ly,
        takes: []
    };

    var tod_models = {};
    _.each(mom.tmd.objects, (obj, idx) => {
        tod_models[idx] = add_model(obj);
    });

    mom.tods.forEach(tod => {
        var take = {
            nframes: tod.nframes,
            resolution: tod.resolution,
            parts: []
        };

        tod.objects.forEach(obj => {
            if (!obj.visible)
                return;

            var model_index = tod_models[obj.tmd_data_id - 1];
            var mats = new Float32Array(16 * obj.mats.length);
            var dp = 0;
            obj.mats.forEach(mat => {
                for (var i = 0; i < 16; ++i)
                    mats[dp++] = mat[i];
            });
                
            var part = {
                model: model_index,
                mats: mats
            };
            take.parts.push(part);
        });

        ch.takes.push(take);
    });

    level.characters.push(ch);
}

function add_gravestone() {
    console.log('adding gravestone');
    var text = fs.readFileSync('./grave2.obj', 'utf8');
    var obj = load_obj(text);
    //console.log('grass:', add_model(objs[0]));
    //console.log('stone:', add_model(objs[1]));
    console.log('grave:', add_model(obj));
}
add_gravestone();


// XXX add dummy tile for zero
level.tiles = [null];

// add all the models and provide a map so i can reference them

for (var lbd_index = 0; lbd_index < stage.nlbds; ++lbd_index) {
    var lbd_path = `${stage_path}/m${padl(lbd_index, 3)}.lbd`;
    var lbd = load_lbd(lbd_path);

    // determine lbd's tile offset
    var ly = Math.floor(lbd_index / stage.columns);
    var lx = lbd_index % stage.columns;
    lx = 20 * lx;
    if (!(ly & 1)) lx += 10;
    ly = 20 * ly;

    // model map for this lbd only
    var tile_models = {};
    _.each(lbd.tmd.objects, (obj, idx) => {
        var tile_model_index = add_model(obj);
        tile_models[idx] = tile_model_index;
    });

    _.each(lbd.tmd.objects, (obj, idx) => {
        var tile_model_index = add_model(obj);
        tile_models[idx] = tile_model_index;
    });

    // add a tile and return tile index
    function add_tile(lbd_tile, map_index) {
        if (!lbd_tile || !lbd_tile.visible)
            return 0;

        var area;
        if (areas && (map_index >= 0)) {
            area = areas[map_index];
        } else {
            area = lbd_tile.collision ? 0 : 1;
        }

        var o = {
            model: tile_models[lbd_tile.tmd_index],
            height: lbd_tile.height,
            rotate: lbd_tile.direction,
            area: area,
            next: add_tile(lbd_tile.extra, -1)
        };

        var tile_index = level.tiles.length;
        level.tiles.push(o);
        return tile_index;
    }

    console.assert(lbd.tiles.length == 400);
    for (var tile_index = 0; tile_index < 400; ++tile_index) {
        var lbd_tile = lbd.tiles[tile_index];
        var tx = lx + tile_index % 20;
        var ty = ly + Math.floor(tile_index / 20);

        var map_index = map_w * ty + tx;
        console.assert(map_index < level.map.tiles.length);
        level.map.tiles[map_index] = add_tile(lbd_tile, map_index);
    }

    // add the characters
    lbd.moms.forEach(mom => {
        add_character(mom, lx, ly);
    });
}

_.each(buffers.buffers, (buf, idx) => {
    buf.trim();
    console.log(`buffer ${idx}: ${filesize(buf.buffer.byteLength).human()}`);
    level.buffers.push(buf.buffer);
});

//var destpath = `${stage_path}/level${padl(stage_index, 2)}.msgpack.gz`;
var destpath = './static/data/lvl5.mpz';
var out = msgpack.encode(level);
var outz = pako.deflate(out, {level: 9});
fs.writeFileSync(destpath, outz);
console.log('wrote:', destpath);
