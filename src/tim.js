export function find_next_tim(f) {
    while (f.sp < (f.end - 8)) {
        var magic = f.read_u32();
        if (magic !== 0x10)
            continue;

        var flags = f.read_u32();
        //console.log(f.sp.toString(16), 'flags:', flags.toString(16));

        if (flags & ~15) {
            // invalid flags
            f.sp -= 4;
            continue;
        }

        var bpp = flags & 7;
        if (!(bpp == 0 || bpp == 1 || bpp == 2 || bpp == 3 || bpp == 4)) {
            console.warn('unknown bpp:', bpp);
            continue;
        }

        f.sp -= 8;
        return true;
    }

    if (f.sp >= (f.end - 8)) {
        // end of file
        return false;
    }
}

function create_image_data(w, h) {
    if (typeof ImageData !== 'undefined')
        return new ImageData(w, h);

    return {
        data: new Uint8ClampedArray(4 * w * h),
        width: w,
        height: h
    };
}

const CONVERT_5_TO_8_BIT = new Uint8Array([
       0,   8,  16,  25,  33,  41,  49,  58,
      66,  74,  82,  90,  99, 107, 115, 123,
     132, 140, 148, 156, 165, 173, 181, 189,
     197, 206, 214, 222, 230, 239, 247, 255
]);

export class TIM {
    constructor() {
        this.image = null;
        this.tpage = 0;
        this.bpp = 0;
        this.clut = false;
    }

    read(f) {
        var magic = f.read_u32();
        console.assert(magic == 0x10);

        var flags = f.read_u32();
        console.assert(!(flags & ~15));

        var has_clut = !!(flags & 8);
        var bpp_type = flags & 7;
        var bpp;
        if (bpp_type == 0) {
            bpp = 4;
        } else if (bpp_type == 1) {
            bpp = 8;
        } else if (bpp_type == 2) {
            bpp = 16;
        } else if (bpp_type == 3) {
            bpp = 24;
        } else if (bpp_type == 4) {
            bpp = 0;
            console.assert('mixed bpp');
        } else {
            console.assert('unknown bpp type:', bpp_type);
        }

        // read or build clut for 4/8 bpp
        var clut;
        if (bpp == 4 || bpp == 8) {
            var info = {
                size: f.read_u32() - 12,
                xorg: f.read_u16(),
                yorg: f.read_u16(),
                ncols: f.read_u16(),
                ncluts: f.read_u16()
            };

            console.assert(info.ncols == (1 << bpp));
            clut = new Uint16Array(info.ncols);

            if (has_clut) {
                console.assert(info.ncluts === 1);
                for (var i = 0; i < info.ncols; ++i)
                    clut[i] = f.read_u16();
            } else {
                // no clut: greyscale
                if (bpp == 4) {
                    for (var i = 0; i < 16; ++i) {
                        var grey = i << 1;
                        clut[i] = grey | (grey<<5) | (grey<<10);
                    }
                } else if (bpp == 8) {
                    for (var i = 0; i < 256; ++i) {
                        var grey = i >> 3;
                        clut[i] = grey | (grey<<5) | (grey<<10);
                    }
                }
            }
        }

        // read image header
        var img = {
            size: f.read_u32() - 12,
            xorg: f.read_u16(),
            yorg: f.read_u16(),
            width: f.read_u16(),
            height: f.read_u16(),
        };

        // calculate tpage
        function getTPage(tp, abr, x, y) {
            return (((tp)&0x3)<<7) |
                   (((abr)&0x3)<<5) |
                   (((y)&0x100)>>4) |
                   (((x)&0x3ff)>>6) |
                   (((y)&0x200)<<2);
        }
        var tpage = getTPage(0, 0, img.xorg, img.yorg);

        // create destination image
        var w = img.width;
        var h = img.height;

        if (bpp == 4)
            w *= 4;
        else if (bpp == 8)
            w *= 2;

        var image = create_image_data(w, h);
        var data = image.data;
        const n_pixels = w * h;
        var dp = 0;

        function write_pixel(bits) {
            data[dp + 0] = CONVERT_5_TO_8_BIT[bits & 0x1f];
            data[dp + 1] = CONVERT_5_TO_8_BIT[(bits >> 5) & 0x1f];
            data[dp + 2] = CONVERT_5_TO_8_BIT[(bits >> 10) & 0x1f];

            var alpha = bits & 0x8000;
            if ((bits & 0x7fff) === 0) {
                data[dp + 3] = alpha ? 255 : 0;
            } else {
                data[dp + 3] = alpha ? 128 : 255;
            }

            dp += 4;
        }

        if (bpp == 16) {
            for (var i = 0; i < n_pixels; ++i) {
                var bits = f.read_u16();
                write_pixel(bits);
            }
        }
        else if (bpp == 8) {
            for (var i = 0; i < n_pixels; ++i) {
                var s = f.read_u8();
                var bits = clut[s];
                write_pixel(bits);
            }
        }
        else if (bpp == 4) {
            var n = n_pixels / 2;
            for (var i = 0; i < n; ++i) {
                var s = f.read_u8();
                var bits0 = clut[s & 0xf];
                var bits1 = clut[(s>>4) & 0xf];
                write_pixel(bits0);
                write_pixel(bits1);
            }
        }

        this.image = image;
        this.tpage = tpage;
        this.bpp = bpp;
        this.clut = has_clut;
        this.xorg = img.xorg;
        this.yorg = img.yorg;
    }
}
