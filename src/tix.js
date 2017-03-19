import {TIM} from './tim';

const CONVERT_5_TO_8_BIT = new Uint8Array([
       0,   8,  16,  25,  33,  41,  49,  58,
      66,  74,  82,  90,  99, 107, 115, 123,
     132, 140, 148, 156, 165, 173, 181, 189,
     197, 206, 214, 222, 230, 239, 247, 255
]);


export class TIX {
    constructor() {
        this.groups = [];

        if (typeof document !== 'undefined') {
            this.canvas = document.createElement('canvas');
            this.canvas.width = 2048;
            this.canvas.height = 512;
            this.ctx = this.canvas.getContext('2d');
            this.texture = null;
        }
    }

    clear() {
        this.groups = [];
    }

    read(f) {
        this.clear();

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

    update_canvas() {
        this.ctx.clearRect(0, 0, 2048, 512);
        _.flatten(this.groups).forEach(tim => {

            console.assert(tim.xorg + tim.image.width <= this.canvas.width);
            console.assert(tim.yorg + tim.image.height <= this.canvas.height);

            this.ctx.putImageData(tim.image, 2*tim.xorg, tim.yorg);
        });
    }

    update_texture() {
        if (!this.texture) {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        this.update_canvas();

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    }
}

function tile_to_image(tile) {
    var image = new ImageData(tile.w, tile.h);
    var pixels = image.data;
    var dp = 0;
    var sp = 0;
    for (var y = 0; y < tile.h; ++y) {
        //dp = 4 * tile.w * (tile.h - y - 1);
        for (var x = 0; x < tile.w; ++x) {
            var s = tile.data[sp++];
            var bits = tile.clut[s];

            pixels[dp + 0] = CONVERT_5_TO_8_BIT[bits & 0x1f];
            pixels[dp + 1] = CONVERT_5_TO_8_BIT[(bits >> 5) & 0x1f];
            pixels[dp + 2] = CONVERT_5_TO_8_BIT[(bits >> 10) & 0x1f];

            var alpha = bits & 0x8000;
            if ((bits & 0x7fff) === 0) {
                pixels[dp + 3] = alpha ? 255 : 0;
            } else {
                pixels[dp + 3] = alpha ? 128 : 255;
            }

            dp += 4;
        }
    }
    return image;
}

function tile_to_pixels(tile) {
    var pixels = new Uint16Array(tile.w * tile.h);
    var dp = 0;
    var sp = 0;
    for (var y = 0; y < tile.h; ++y) {
        for (var x = 0; x < tile.w; ++x) {
            var s = tile.data[sp++];
            var bits = tile.clut[s];

            var R = bits & 0x1f;
            var G = (bits >>> 5) & 0x1f;
            var B = (bits >>> 10) & 0x1f;
            var A = (bits & 0x8000) >> 15;

            var alpha = bits & 0x8000;
            if ((bits & 0x7fff) === 0) {
                A = 0;
            } else {
                A = 1;
            }

            pixels[dp++] = 
                (R << 11) |
                (G << 6) |
                (B << 1) |
                (A << 0);

            /*
            var alpha = bits & 0x8000;
            if ((bits & 0x7fff) === 0) {
                pixels[dp + 3] = alpha ? 255 : 0;
            } else {
                pixels[dp + 3] = alpha ? 128 : 255;
            }
            */
        }
    }
    return pixels;
}

export class TIX2 {
    constructor() {
        this.texture = null;
        this.tiles = null;

        /*
        this.canvas = document.createElement('canvas');
        this.canvas.width = 2048;
        this.canvas.height = 512;
        this.ctx = this.canvas.getContext('2d');
        */
    }

    read(tiles) {
        this.tiles = tiles;
    }

    create_texture() {
        console.assert(!this.texture);
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA,
            2048, 512, 0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    /*
    update_canvas() {
        this.ctx.clearRect(0, 0, 2048, 512);
        this.tiles.forEach(tile => {
            var image = tile_to_image(tile);
            console.assert(tile.x + image.width <= this.canvas.width);
            console.assert(tile.y + image.height <= this.canvas.height);
            this.ctx.putImageData(image, tile.x, tile.y);
        });
    }
    */

    update_texture() {
        this.create_texture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        this.tiles.forEach(tile => {
            var image = tile_to_image(tile);
            gl.texSubImage2D(
                gl.TEXTURE_2D, 0,
                tile.x, tile.y, tile.w, tile.h,
                gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(image.data));
        });
    }
}
