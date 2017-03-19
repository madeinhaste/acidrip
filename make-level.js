import {LBD} from './src/lbd';
import {BinaryReader, padl} from './src/utils';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var msgpack = require('msgpack-lite');
var filesize = require('file-size');

function load_lbd(filepath) {
    var buf = fs.readFileSync(filepath);
    var f = new BinaryReader(buf.buffer);
    var lbd = new LBD;
    lbd.read(f);
    return lbd;
}

var stage_index = 5;
var stages = require('./static/data/stages.json');
var stage = stages[stage_index];
var stage_path = `./static/data/cdi/stg${padl(stage_index, 2)}`;

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
console.log(map_w * map_h);

level.map.tiles = new Uint32Array(map_w * map_h);

function add_tile(tile) {
}

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
    var model_index = level.models.length;
    level.models.push(o);
    return model_index;
}

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

    // add a tile and return tile index
    function add_tile(lbd_tile) {
        if (!lbd_tile || !lbd_tile.visible)
            return 0;

        var o = {
            model: tile_models[lbd_tile.tmd_index],
            height: lbd_tile.height,
            rotate: lbd_tile.direction,
            collision: lbd_tile.collision,
            next: add_tile(lbd_tile.extra)
        };

        var tile_index = level.tiles.length;
        level.tiles.push(o);
        return tile_index;
    }

    // XXX add dummy tile for zero

    console.assert(lbd.tiles.length == 400);
    for (var tile_index = 0; tile_index < 400; ++tile_index) {
        var lbd_tile = lbd.tiles[tile_index];
        var tx = lx + tile_index % 20;
        var ty = ly + Math.floor(tile_index / 20);

        var map_index = map_w * ty + tx;
        console.assert(map_index < level.map.tiles.length);
        level.map.tiles[map_index] = add_tile(lbd_tile);
    }
}

_.each(buffers.buffers, (buf, idx) => {
    buf.trim();
    console.log(`buffer ${idx}: ${filesize(buf.buffer.byteLength).human()}`);
    level.buffers.push(buf.buffer);
});

var destpath = `${stage_path}/level${padl(stage_index, 2)}.msgpack`;
var out = msgpack.encode(level);
fs.writeFileSync(destpath, out);
console.log('wrote:', destpath);
