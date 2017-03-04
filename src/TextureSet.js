import {BinaryReader} from './utils';
import {TIM, find_next_tim} from './tim';

export class TextureSet {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 2048;
        this.canvas.height = 1024;
        this.ctx = this.canvas.getContext('2d');
        this.texture = null;
        this.tix = {};
    }

    clear() {
        var ctx = this.ctx;
        ctx.clearRect(0, 0, 2048, 1024);
        //return;

        ctx.fillStyle = '#444';
        ctx.fillRect(0, 0, 2048, 1024);

        ctx.fillStyle = '#000';
        for (var y = 0; y < 8; ++y) {
            ctx.fillRect(0, y<<8, 2048, 1);
            ctx.fillRect(y<<8, 0, 1, 2048);
        }

        this.draw_labels();
    }

    draw_labels() {
        var ctx = this.ctx;

        for (var i = 0; i < 32; ++i) {
            var dx = (i & 7) << 8;
            var dy = (i >> 3) << 8;

            dx += 6;
            dy += 23;

            for (var y = 0; y < 256; y += 32) {
                for (var x = 0; x < 256; x += 32) {
                    ctx.font = '15px "Droid Sans"';
                    ctx.fillStyle = '#f00';
                    //ctx.fillRect(dx - 1 + x, dy - 15 + y, 8, 8);

                    var j = 'ABCD'.substr(((y>>7)<<1) | (x>>7), 1);
                    ctx.fillText(j, dx + x + 14, dy + y + 7);

                    ctx.font = '20px "Droid Sans"';
                    ctx.save();
                    ctx.shadowColor = '#000';
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 1;
                    ctx.fillStyle = '#fff';
                    ctx.fillText(''+i, dx + x, dy + y);
                    ctx.restore();
                }
            }
        }
    }

    get_tix(name) {
        var cache = this.tix;
        return new Promise((resolve, reject) => {
            if (name in cache) {
                //console.log('FOUND:', name);
                resolve(cache[name]);
            } else {
                load_tix_images(name).then(images => {
                    cache[name] = images;
                    resolve(images);
                });
            }
        });
    }

    load_tix(name) {
        var ctx = this.ctx;
        return this.get_tix(name).then(images => {
            this.clear();
            for (var tpage = 0; tpage < 32; ++tpage) {
                var image = images[tpage];
                if (image) {
                    var dx = (tpage & 7) << 8;
                    var dy = (tpage >> 3) << 8;
                    ctx.putImageData(image, dx, dy);
                }
            }
            this.update_texture();
        });
    }

    load_tix_page(dpage, name, spage, flip, tx, ty) {
        var ctx = this.ctx;
        return this.get_tix(name).then(images => {
            var image = images[spage];
            //console.assert(image);

            if (image) {
                var tmp = document.createElement('canvas');
                tmp.width = tmp.height = 256;
                var tmp_ctx = tmp.getContext('2d');

                //ctx.putImageData(image, dx, dy);

                // rotate
                tx = tx ? 64*tx : 0;
                ty = ty ? 64*ty : 0;
                if (tx || ty) {
                    for (var tty = 0; tty < 2; ++tty)
                        for (var ttx = 0; ttx < 2; ++ttx)
                            tmp_ctx.putImageData(image, ttx*256 - tx, tty*256 - ty);
                } else {
                    tmp_ctx.putImageData(image, 0, 0);
                }

                var dx = (dpage & 7) << 8;
                var dy = (dpage >> 3) << 8;

                // flip
                if (flip & 1) dx += 256;
                if (flip & 2) dy += 256;

                ctx.save();
                ctx.translate(dx, dy);
                ctx.scale((flip & 1) ? -1 : 1, (flip & 2) ? -1 : 1);
                ctx.drawImage(tmp, 0, 0);
                ctx.restore();
            }

            this.update_texture();
        });
    }

    update_texture() {
        if (!this.texture) {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    }
}

function load_tix_images(name) {
    var url = `data/cdi/${name}.tix`;
    return fetch(url)
        .then(r => r.arrayBuffer())
        .then(buf => {
            var f = new BinaryReader(buf);
            var images = [];
            while (find_next_tim(f)) {
                var tim = new TIM;
                tim.read(f);
                images[tim.tpage] = tim.image;
            }
            return images;
        });
}
