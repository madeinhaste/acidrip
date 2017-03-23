import {TIX} from './src/tix';
import {BinaryReader, padl} from './src/utils';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var msgpack = require('msgpack-lite');
var pako = require('pako');

function replace_ext(fp, ext) {
    var i = fp.lastIndexOf('.');
    if (i < 0)
        return fp + ext;
    else
        return fp.substr(0, i) + ext;
}

function convert_tix(filepath) {

    var buf = fs.readFileSync(filepath);
    var f = new BinaryReader(buf.buffer);
    var tix = new TIX;
    tix.read(f);

    var tims = _.flatten(tix.groups);

    // output tiles
    var tiles = [];
    tims.forEach(tim => {
        tiles.push({
            x: tim.xorg * 2,
            y: tim.yorg,
            w: tim.image.width,
            h: tim.image.height,
            clut: tim.clut,
            data: tim.data
        });
    });

    // u32 ntiles
    // u16 x, y, w, h
    // u16 clut[256]
    // u8 data[]

    return tiles;
}

//for (var i = 0; i < 14; ++i) {
var level_index = 5;
for (var c of 'abcd') {
    var path = `./cdi/stg${padl(level_index, 2)}/tex${c}.tix`;
    var tiles = convert_tix(path, destpath);
    var out = msgpack.encode(tiles);
    var outz = pako.deflate(out, {level: 9});
    var destpath = `./static/data/tex5${c}.mpz`;
    fs.writeFileSync(destpath, outz);
    console.log('wrote:', destpath);
}
