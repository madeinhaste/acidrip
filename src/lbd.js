import {TMD} from './tmd';
import {MOM} from './mom';
import {fourcc} from './utils';

const FOURCC_MML = fourcc('MML ');

export class LBD {
    constructor() {
        this.tiles = [];
        this.tmd = null;
        this.moms = [];
    }

    read(f) {
        // header
        f.skip(8);
        var tmd_ptr = f.read_u32() + 24;
        var tmd_len = f.read_u32();
        var mml_ptr = f.read_u32();
        var mml_len = f.read_u32();
        f.skip(8);

        // tiles
        for (var i = 0; i < 400; ++i) {
            var tile = new LBDTile;
            tile.read(f);
            this.tiles.push(tile);
        }

        // tmd
        f.seek(tmd_ptr);
        this.tmd = new TMD;
        this.tmd.read(f);

        // moms
        if (!mml_len)
            return;

        f.seek(mml_ptr);
        var magic = f.read_u32();
        console.assert(magic == FOURCC_MML);

        var mom_count = f.read_u32();
        for (var i = 0; i < mom_count; ++i) {
            var mom_ptr = mml_ptr + f.read_u32();
            f.push();
            f.seek(mom_ptr);
            var mom = new MOM;
            mom.read(f);
            this.moms.push(mom);
            f.pop();
        }
    }
}

export class LBDTile {
    constructor() {
        this.visible = false;
        this.tmd_index = 0;
        this.collision = 0;
        this.direction = 0;
        this.height = 0;
        this.extra = null;
    }

    read(f) {
        this.visible = (f.read_u8() !== 0);
        f.skip(1);
        this.tmd_index = f.read_u8();
        f.skip(1);
        this.collision = f.read_u8();
        this.direction = f.read_u8();
        this.height = f.read_i16();

        var extra_ptr = f.read_u16();
        if (extra_ptr) {
            f.push();
            f.seek(extra_ptr + 24);
            this.extra = new LBDTile;
            this.extra.read(f);
            f.pop();
        }

        f.skip(2);
    }
}
