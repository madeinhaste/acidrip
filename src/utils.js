export const DEG_PER_RAD = 180/Math.PI;
export const RAD_PER_DEG = Math.PI/180;
export const TWO_PI = 2*Math.PI;

export function lerp(a, b, x) {
    return (1 - x) * a + x * b;
}

export function clamp(x, a, b) {
    if (x < a) return a;
    else if (x > b) return b;
    else return x;
}

export function fract(x) {
    var xi = Math.floor(x);
    var xf = x - xi;
    return xf;
}

export function modulo(x, y) {
    return ((x % y) + y) % y;
}

export function each_line(text, callback) {
    var sp = 0;
    var lineno = 0;
    while (sp < text.length) {
        var ep = text.indexOf('\n', sp);
        if (ep == -1)
            ep = text.length;

        var line = text.substr(sp, ep - sp);
        sp = ep + 1;

        callback(line, lineno++);
    }
}

export function save_file_as(data, filename, type) {
    type = type || 'application/octet-binary';
    var blob = new Blob([ data ], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.click();
    URL.revokeObjectURL(blob);
}

export function get_event_offset(out, e) {
    if (_.isUndefined(e.offsetX)) {
        out[0] = e.layerX;
        out[1] = e.layerY;
    } else {
        out[0] = e.offsetX;
        out[1] = e.offsetY;
    }
}

export class BinaryReader {
    constructor(ab) {
        this.ab = ab;
        this.dv = new DataView(ab);
        this.sp = 0;
        this.end = ab.byteLength;
        this.sp_stack = [];
    }

    read_u8() {
        var v = this.dv.getUint8(this.sp++);
        return v;
    }

    read_i8() {
        var v = this.dv.getInt8(this.sp++);
        return v;
    }

    read_u16() {
        var v = this.dv.getUint16(this.sp, true);
        this.sp += 2;
        return v;
    }

    read_i16() {
        var v = this.dv.getInt16(this.sp, true);
        this.sp += 2;
        return v;
    }

    read_u32() {
        var v = this.dv.getUint32(this.sp, true);
        this.sp += 4;
        return v;
    }

    read_i32() {
        var v = this.dv.getInt32(this.sp, true);
        this.sp += 4;
        return v;
    }

    skip(n) {
        this.sp += n;
    }
    
    seek(sp) {
        this.sp = sp;
    }

    push() {
        this.sp_stack.push(this.sp);
    }

    pop() {
        console.assert(this.sp_stack.length);
        this.sp = this.sp_stack.pop();
    }
}

export function fetch_binary(url) {
    return fetch(url)
        .then(r => r.arrayBuffer())
        .then(ab => {
            var f = new BinaryReader(ab);
            return f;
        });
}

export function fourcc(word) {
    console.assert(word.length == 4);
    var v = 0;
    for (var i = 3; i >= 0; --i) {
        v = v << 8;
        v = v | word.charCodeAt(i);
    }
    return v;
}

export function padl(x, n, c='0') {
    var s = ''+x;
    while (s.length < n)
        s = c + s;
    return s;
}
