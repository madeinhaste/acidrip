import {TMD} from './tmd';
import {TOD} from './tod';
import {fourcc} from './utils';

const FOURCC_MOM = fourcc('MOM ');
const FOURCC_MOS = fourcc('MOS ');

export class MOM {
    constructor() {
        this.tmd = null;
        this.tods = [];
    }

    read(f) {
        var mom_top = f.sp;
        var magic = f.read_u32();
        console.assert(magic == FOURCC_MOM);
        var mom_len = f.read_u32();
        var tmd_ptr = mom_top + f.read_u32();
        var magic = f.read_u32();
        console.assert(magic == FOURCC_MOS);

        // TODs

        //this.header = new Uint8Array(f.ab.slice(f.sp, tmd_ptr));

        var tod_top = f.sp;
        var tod_count = f.read_u32();
        var tods = this.tods = [];
        for (var i = 0; i < tod_count; ++i) {
            var tod_ptr = f.read_u32();
            f.push();
            f.seek(tod_top + tod_ptr - 4);
            var tod = new TOD;
            tod.read(f);
            tods.push(tod);
            f.pop();
        }

        // TMD

        f.seek(tmd_ptr);
        this.tmd = new TMD;
        this.tmd.read(f);
    }
}
