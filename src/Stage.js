import {TIX} from './tix';
import {LBD} from './lbd';
import {fetch_binary, padl} from './utils';

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
        console.assert(!this.lbds.length);
        console.assert(this.lbd_count);

        _.times(this.lbd_count, lbd_index => {
            load_lbd(this.id, lbd_index)
                .then(lbd => {
                    this.lbds[lbd_index] = lbd;
                })
        });

        load_tix(this.id)
            .then(tix => {
                this.tix = tix;
                // XXX maybe move texture mgmt to renderer
                tix.update_texture();
            });
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
