import {TMD} from './tmd';
import {fourcc} from './utils';

const FOURCC_MOM = fourcc('MOM ');
const FOURCC_MOS = fourcc('MOS ');

export class MOM {
    constructor() {
        this.tmd = null;
        this.header = null;
    }

    read(f) {
        var mom_top = f.sp;
        var magic = f.read_u32();
        console.assert(magic == FOURCC_MOM);
        var mom_len = f.read_u32();
        var tmd_ptr = mom_top + f.read_u32();
        var magic = f.read_u32();
        console.assert(magic == FOURCC_MOS);

        this.header = new Uint8Array(f.ab.slice(f.sp, tmd_ptr));

        f.seek(tmd_ptr);
        this.tmd = new TMD;
        this.tmd.read(f);
    }
}
