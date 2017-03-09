import {BinaryReader} from './src/utils';
import {LBD} from './src/lbd';
import {TMD} from './src/tmd';

var fs = require('fs');
var pad = require('pad-left');

//var lbd = new LBD;
//lbd.read(f);
//console.log(lbd.tmd.objects.length);

function load_lbd2(filepath) {
    var buf = fs.readFileSync(filepath);
    var f = new BinaryReader(buf.buffer);
    var lbd = new LBD;
    lbd.read(f);
    return lbd;
}

function load_lbd(filepath) {
    var buf = fs.readFileSync(filepath);
    var f = new BinaryReader(buf.buffer);

    f.skip(8);
    var tmd_ptr = f.read_u32() + 24;
    var tmd_len = f.read_u32();
    var mml_ptr = f.read_u32();
    var mml_len = f.read_u32();
    f.skip(8);

    function fourcc(word) {
        console.assert(word.length == 4);
        var v = 0;
        for (var i = 3; i >= 0; --i) {
            v = v << 8;
            v = v | word.charCodeAt(i);
        }
        return v;
    }

    if (mml_len) {
        console.log(filepath);
        f.seek(mml_ptr);

        var magic = f.read_u32();
        console.assert(magic == fourcc('MML '));

        var mom_count = f.read_u32();
        for (var i = 0; i < mom_count; ++i) {
            var mom_ptr = mml_ptr + f.read_u32();
            f.push();
                f.seek(mom_ptr);
                var magic = f.read_u32();
                console.assert(magic == fourcc('MOM '));
                var mom_len = f.read_u32();
                var tmd_ptr = mom_ptr + f.read_u32();
                var magic = f.read_u32();
                console.assert(magic == fourcc('MOS '));

                var mom_header_len = tmd_ptr - f.sp;

                f.push();
                    f.seek(tmd_ptr);
                    var tmd = new TMD;
                    tmd.read(f);
                    console.log(`  ${i}: ${tmd.objects.length}  (${mom_header_len})`);
                f.pop();
            f.pop();
        }
    }
}

var prefix = './static/data/cdi/stg05';
for (var i = 0; i < 30; ++i) {
    var suffix = `m${pad(i, 3, '0')}.lbd`;
    var lbd = load_lbd2(`${prefix}/${suffix}`);
    if (lbd.moms.length) {
        console.log(suffix);
        for (var j = 0; j < lbd.moms.length; ++j) {
            var mom = lbd.moms[j];
            console.log(`  ${j}: ${mom.tmd.objects.length}  (${mom.header.length})`);
        }
    }
}
