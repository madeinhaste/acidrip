import {mat4} from 'gl-matrix';
import {RAD_PER_DEG, padl} from './utils';
import toposort from './toposort';

function hex(x, n=2) {
    return padl(x.toString(16), n);
}

const PACKET_TYPES = [
    'attribute',
    'coordinate',
    'tmd-data-id',
    'parent-object-id',
    'matrix-value',
    'tmd-data',
    'light-source',
    'camera',
    'object-control',
    'user-defined-0',
    'user-defined-1',
    'user-defined-2',
    'user-defined-3',
    'user-defined-4',
    'system-reserved',
    'special-commands'
];

const PACKET_ATTRIBUTE = 0;
const PACKET_COORDINATE = 1;
const PACKET_TMD_DATA_ID = 2;
const PACKET_PARENT_OBJECT_ID = 3;
const PACKET_OBJECT_CONTROL = 8;
const PACKET_SPECIAL_COMMANDS = 15;

var seen_packet_types = new Set;

export class TOD {
    constructor() {
        this.init(0, 1);
    }

    init(nframes, resolution) {
        this.objects = new Array(16);
        this.nframes = nframes;
        this.resolution = resolution;
    }

    read_packet(f, frame_number) {
        var hdr = f.read_u32();
        var object_id = hdr & 0xffff;
        var packet_type = (hdr >>> 16) & 0xf;
        var packet_flag = (hdr >>> 20) & 0xf;
        var packet_length = (hdr >>> 24) & 0xff;

        var pt = PACKET_TYPES[packet_type];
        seen_packet_types.add(pt);

        //console.log(`      obj: ${object_id}  type: ${pt}  flag: ${packet_flag}`);

        var skip = false;

        switch (packet_type) {
            case PACKET_ATTRIBUTE:
                var mask = f.read_u32();
                var value = f.read_u32();
                //console.log(`        mask: ${hex(mask, 8)}  value: ${hex(value, 8)}`);

                if (mask == 0x80000000) {
                    var v = value & mask;
                    var obj = this.objects[object_id];
                    obj.visible = !v;
                }
                break;

            case PACKET_COORDINATE:
                var f_delta = !!(packet_flag & 1);
                var f_R = !!(packet_flag & 2);
                var f_S = !!(packet_flag & 4);
                var f_T = !!(packet_flag & 8);

                var co = [];
                if (f_delta)
                    co.push('del')
                else
                    co.push('abs')

                var rx, ry, rz;
                var sx, sy, sz;
                var tx, ty, tz;

                if (f_R) {
                    rx = (f.read_i32() / 4096);
                    ry = (f.read_i32() / 4096);
                    rz = (f.read_i32() / 4096);
                    co.push(`R(${rx}, ${ry}, ${rz})`);
                }

                if (f_S) {
                    sx = (f.read_i16() / 4096);
                    sy = (f.read_i16() / 4096);
                    sz = (f.read_i16() / 4096);
                    f.skip(2);
                    co.push(`S(${sx}, ${sy}, ${sz})`);
                }

                if (f_T) {
                    tx = f.read_i32();
                    ty = f.read_i32();
                    tz = f.read_i32();
                    co.push(`T(${tx}, ${ty}, ${tz})`);
                }

                // construct matrix
                var mat = mat4.create();
                if (f_T) {
                    mat4.translate(mat, mat, [tx, -ty, -tz]);
                }
                if (f_S) {
                    mat4.scale(mat, mat, [sx, sy, sz]);
                }
                if (f_R) {
                    rx && mat4.rotateX(mat, mat, rx * RAD_PER_DEG);
                    ry && mat4.rotateY(mat, mat, -ry * RAD_PER_DEG);
                    rz && mat4.rotateZ(mat, mat, -rz * RAD_PER_DEG);
                }

                var obj = this.objects[object_id];
                obj.update_matrix(frame_number, mat, f_delta);

                //console.log(`        ${co.join('  ')}`);
                break;

            case PACKET_TMD_DATA_ID:
                var word = f.read_u32();
                var tmd_data_id = word & 0xffff;
                //console.log(`        tmd-data-id: ${tmd_data_id}`);

                // update object
                var obj = this.objects[object_id];
                console.assert(obj);
                obj.tmd_data_id = tmd_data_id;
                break;

            case PACKET_PARENT_OBJECT_ID:
                var word = f.read_u32();
                var parent_object_id = word & 0xffff;
                //console.log(`        parent-object-id: ${parent_object_id}`);
                
                // update object
                var obj = this.objects[object_id];
                console.assert(obj);
                obj.parent_id = parent_object_id;
                break;

            case PACKET_OBJECT_CONTROL:
                //console.log(`        ${packet_flag ? 'kill' : 'create'}`);
                if (!packet_flag) {
                    // create object
                    console.assert(object_id !== 0);    // check there's no root object
                    var obj = new TODObject(this.nframes);
                    obj.id = object_id;
                    this.objects[object_id] = obj;
                }
                break;

            case PACKET_SPECIAL_COMMANDS:
                skip = true;
                break;

            default:
                console.assert(false, 'unknown packet type!');
        }

        if (skip)
            f.skip((packet_length - 1) * 4);
    }

    read_frame(f) {
        var hdr = f.read_u32();
        var frame_size = hdr & 0xffff;
        var npackets = hdr >>> 16;
        var frame_number = f.read_u32();
        //console.log(`    frame: ${frame_number}  fsize: ${frame_size}  np: ${npackets}`);

        //f.skip((frame_size - 2) * 4);

        for (var i = 0; i < npackets; ++i) {
            this.read_packet(f, frame_number);
        }
    }

    read(f) {
        var hdr = f.read_u32();
        var file_id = hdr & 0xff;
        console.assert(file_id == 0x50);
        var version = (hdr >>> 8) & 0xff;
        //console.assert(version == 0x00);

        var resolution = (hdr >>> 16);
        var nframes = f.read_u32();

        // setup animation
        this.init(nframes, resolution);

        //console.log('TOD:');
        //console.log('  resolution:', resolution);
        //console.log('  nframes:', nframes);

        for (var i = 0; i < nframes; ++i) {
            this.read_frame(f);
        }

        //console.log('seen packet types:', Array.from(seen_packet_types).join(', '));

        this.finish_animation();
    }

    sort_object_ids() {
        var nodes = [0];    // root node
        var edges = [];
        this.objects.forEach(obj => {
            nodes.push(obj.id);
            edges.push([ obj.parent_id, obj.id ]);
        });
        return toposort(nodes, edges);
    }

    finish_animation() {
        var object_ids = this.sort_object_ids();
        var mat = mat4.create();    // temp matrix
        for (var frame_number = 0; frame_number < this.nframes; ++frame_number) {
            object_ids.forEach(object_id => {
                if (object_id == 0) {
                    // root matrix
                    return;
                }

                var object = this.objects[object_id];

                if (object.parent_id == 0) {
                    // parented to root, so no calculation required
                    return;
                }
                    
                var parent = this.objects[object.parent_id];
                console.assert(object && parent);

                var parent_mat = parent.mats[frame_number];
                var object_mat = object.mats[frame_number];

                mat4.multiply(object_mat, parent_mat, object_mat);
            });
        }

        //console.log('DONE:', this);
    }
}

class TODObject {
    constructor(nframes) {
        this.id = 0;
        this.parent_id = 0;
        this.tmd_data_id = 0;
        this.visible = false;
        this.mats = [];
        for (var i = 0; i < nframes; ++i)
            this.mats.push(mat4.create());
        //_.times(nframes, mat4.create);
    }

    update_matrix(frame_number, mat, delta) {
        var m = mat4.create();

        if (delta && frame_number) {
            // differential update from previous frame
            mat4.copy(m, this.mats[frame_number - 1]);
            mat4.multiply(m, m, mat);
        } else {
            // absolute update
            mat4.copy(m, mat);
        }
        
        // copy to all succeeding frames
        for (var i = frame_number; i < this.mats.length; ++i)
            mat4.copy(this.mats[i], m);
    }
}
