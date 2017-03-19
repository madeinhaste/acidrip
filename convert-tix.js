import {TIX} from './src/tix';
import {BinaryReader, padl} from './src/utils';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var msgpack = require('msgpack-lite');

function replace_ext(fp, ext) {
    var i = fp.lastIndexOf('.');
    if (i < 0)
        return fp + ext;
    else
        return fp.substr(0, i) + ext;
}

function convert_tix(filepath) {
    var destpath = replace_ext(filepath, '.msgpack');

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

    var out = msgpack.encode(tiles);
    fs.writeFileSync(destpath, out);
    console.log('wrote:', destpath);
}

for (var i = 0; i < 14; ++i) {
    for (var c of 'abcd') {
        var path = `./static/data/cdi/stg${padl(i, 2)}/tex${c}.tix`;
        //console.log(path);
        convert_tix(path);
    }
}
