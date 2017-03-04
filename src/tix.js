import {TIM} from './tim';

export class TIX {
    constructor() {
        this.groups = [];
    }

    read(f) {
        var ngroups = f.read_u32();
        for (var group_idx = 0; group_idx < ngroups; ++group_idx) {
            var group_top = f.read_u32();
            f.push();
            f.seek(group_top);
            var ntims = f.read_u32();
            if (ntims) {
                var group = [];
                this.groups.push(group);
            }
            for (var tim_idx = 0; tim_idx < ntims; ++tim_idx) {
                var tim_ptr = f.read_u32() + group_top;
                f.push();
                f.seek(tim_ptr);
                var tim = new TIM;
                tim.read(f);
                group.push(tim);
                f.pop();
            }

            f.pop();
        }
    }
}
