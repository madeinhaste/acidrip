import {each_line} from './utils';
import {vec2, vec3, vec4} from 'gl-matrix';

const PRECISION_FRAGMENT = 'medium';

// keeps track of array flag of the vertex attributes
var attribArrayManager = {
    enabledMask: 0,
    maxEnabledIndex: -1,

    disableAll: function() {
        for (var index = 0; index <= this.maxEnabledIndex; ++index) {
            var mask = 1 << index;
            if (mask & this.enabledMask)
                gl.disableVertexAttribArray(index);
        }

        this.enabledMask = 0;
        this.maxEnabledIndex = -1;
    },

    enable: function(index) {
        var mask = 1 << index;
        if (!(mask & this.enabledMask)) {
            gl.enableVertexAttribArray(index);
            this.enabledMask |= mask;
            this.maxEnabledIndex = Math.max(this.maxEnabledIndex, index);
        }
    },

    disable: function(index) {
        var mask = 1 << index;
        if (mask & this.enabledMask) {
            gl.disableVertexAttribArray(index);
            this.enabledMask &= ~mask;
            // XXX don't bother changing maxEnabledIndex
        }
    },
};

// program class
export function Program(name) {
    this.name = name;
    this.program = null;

    this.attribs = {};
    this.uniforms = {};
}

Program.prototype.set_program = function(program) {
    this.program = program;

    var numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (var i = 0; i < numAttribs; ++i) {
        var attrib = gl.getActiveAttrib(program, i);
        this.attribs[attrib.name] = {
            index: gl.getAttribLocation(program, attrib.name),
            name: attrib.name,
            size: attrib.size,
            type: attrib.type,
        };
    }

    var nextTexUnit = 0;
    function assignTexUnit(uniform) {
        if (uniform.type == gl.SAMPLER_2D || uniform.type == gl.SAMPLER_CUBE) {
            var unit = nextTexUnit;
            nextTexUnit += uniform.size;
            return unit;
        }

        return -1;
    }

    var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < numUniforms; ++i) {
        var uniform = gl.getActiveUniform(program, i);
        this.uniforms[uniform.name] = {
            location: gl.getUniformLocation(program, uniform.name),
            name: uniform.name,
            size: uniform.size,
            type: uniform.type,
            texUnit: assignTexUnit(uniform),
        };
    }
};

Program.prototype.use = function() {
    gl.useProgram(this.program);
    attribArrayManager.disableAll();
    return this;
};

Program.prototype.getUniformLocation = function(name) {
    var uniform = this.uniforms[name];
    //console.assert(uniform, 'missing uniform: '+name);
    return uniform ? uniform.location : null;
};

Program.prototype.getAttribIndex = function(name) {
    var attrib = this.attribs[name];
    //console.assert(uniform, 'missing attrib: '+name);
    return attrib ? attrib.index : -1;
};

Program.prototype.uniform1i = function(name, x) {
    var location = this.getUniformLocation(name);
    if (location)
        gl.uniform1i(location, x);
};

Program.prototype.uniform1f = function(name, x) {
    var location = this.getUniformLocation(name);
    if (location)
        gl.uniform1f(location, x);
};

Program.prototype.uniform2f = function(name, x, y) {
    var location = this.getUniformLocation(name);
    if (location)
        gl.uniform2f(location, x, y);
};

Program.prototype.uniform3f = function(name, x, y, z) {
    var location = this.getUniformLocation(name);
    if (location)
        gl.uniform3f(location, x, y, z);
};

Program.prototype.uniform4f = function(name, x, y, z, w) {
    var location = this.getUniformLocation(name);
    if (location)
        gl.uniform4f(location, x, y, z, w);
};

Program.prototype.uniform1iv = function(name, v) {
    var location = this.getUniformLocation(name);
    if (location)
        gl.uniform1iv(location, v);
};

Program.prototype.uniform1fv = function(name, v) {
    var location = this.getUniformLocation(name);
    if (location)
        gl.uniform1fv(location, v);
};

Program.prototype.uniform2fv = function(name, v) {
    var location = this.getUniformLocation(name);
    if (location)
        gl.uniform2fv(location, v);
};

Program.prototype.uniform3fv = function(name, v) {
    var location = this.getUniformLocation(name);
    if (location)
        gl.uniform3fv(location, v);
};

Program.prototype.uniform4fv = function(name, v) {
    var location = this.getUniformLocation(name);
    if (location)
        gl.uniform4fv(location, v);
};

Program.prototype.uniformMatrix3fv = function(name, data, transpose) {
    var location = this.getUniformLocation(name);
    if (location) {
        transpose = transpose || false;
        gl.uniformMatrix3fv(location, transpose, data);
    }
};

Program.prototype.uniformMatrix4fv = function(name, data, transpose) {
    var location = this.getUniformLocation(name);
    if (location) {
        transpose = transpose || false;
        gl.uniformMatrix4fv(location, transpose, data);
    }
};

Program.prototype.uniformSampler = function(name, target, texture) {
    var uniform = this.uniforms[name];
    if (uniform) {
        gl.activeTexture(gl.TEXTURE0 + uniform.texUnit);
        gl.bindTexture(target, texture);
        gl.uniform1i(uniform.location, uniform.texUnit);
    }
};

Program.prototype.uniformSampler2D = function(name, texture) {
    this.uniformSampler(name, gl.TEXTURE_2D, texture);
};

Program.prototype.uniformSamplerCube = function(name, texture) {
    this.uniformSampler(name, gl.TEXTURE_CUBE_MAP, texture);
};

Program.prototype.enableVertexAttribArray = function(name) {
    var attrib = this.attribs[name];
    if (attrib) {
        attribArrayManager.enable(attrib.index);
        return attrib.index;
    } else {
        return -1;
    }
};

Program.prototype.disableVertexAttribArray = function(name) {
    var attrib = this.attribs[name];
    if (attrib) {
        attribArrayManager.disable(attrib.index);
        return attrib.index;
    } else {
        return -1;
    }
};

Program.prototype.vertexAttribPointer = function(name, size, type, normalize, offset, stride) {
    var attrib = this.attribs[name];
    if (attrib) {
        attribArrayManager.enable(attrib.index);
        gl.vertexAttribPointer(attrib.index, size, type, normalize, offset, stride);
    }
};

// program creation
function createShader(type, source, name) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        return shader;

    // compilation error
    var log = gl.getShaderInfoLog(shader);
    console.log('Shader: '+name);
    console.log('Type: '+(type == gl.VERTEX_SHADER ? 'vertex' : 'fragment'));

    each_line(source, function(line, i) {
        var lineNumber = ('  '+(i + 1)).slice(-3);
        console.log(lineNumber+': '+line);
    });

    console.log('Error:', gl.getShaderInfoLog(shader));

    throw {
        type: 'COMPILE',
        shaderType: (type == gl.VERTEX_SHADER ? 'vertex' : 'fragment'),
        name: name,
        shader: shader,
        source: gl.getShaderSource(shader),
        log: gl.getShaderInfoLog(shader),
    };
}

function createProgram(options) {
    var FRAGMENT_HEADER = `precision ${PRECISION_FRAGMENT}p float;\n`;

    var program = gl.createProgram();
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, options.vertexSource, options.name));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, FRAGMENT_HEADER + options.fragmentSource, options.name));
    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS))
        return program;

    console.log('Link Error:', gl.getProgramInfoLog(program));

    // link error
    throw {
        type: 'LINK',
        name: options.name,
        program: program,
        log: gl.getProgramInfoLog(program),
    };
}

// program loader
export var shaderSources = {};

function fetchShaderSources(urls) {
    shaderSources = {};

    function processSourceText(text) {
        var regex = /^\/\/\s*(\w+(?:.(vertex|fragment))?)\s*\/\//;
        var source = [];
        each_line(text,  function(line) {
            var m = regex.exec(line);
            if (m) {
                var key = m[1];
                shaderSources[key] = source = [];
            } else {
                source.push(line);
            }
        });
    }

    // XXX synchronous
    _.each(urls, function(url) {
        if (_.endsWith(url, '.glsl')) {
            // fetch glsl
            $.ajax({
                url: url,
                async: false,
                cache: false,
                success: processSourceText,
            });
        } else {
            // is glsl
            processSourceText(url);
        }
    });

    // concatenate lines
    _.each(shaderSources, function(source, key) {
        shaderSources[key] = source.join('\n');
    });
}

export var get_program = (function() {
    function checkSourceExists(name) {
        var exists = !!shaderSources[name];
        console.assert(exists, name+' not found.');
        return exists;
    }

    function makeProgram(name, options) {
        if (!(checkSourceExists(name) &&
              checkSourceExists(name+'.vertex') &&
              checkSourceExists(name+'.fragment')))
        {
            return;
        }

        options = options || {};

        var defines = '';
        if (options.defines) {
            _.each(options.defines, function(dv, dk) {
                defines += '#define '+dk+' '+dv+'\n';
            });
        }

        // common functions, uniforms, varyings etc
        var common = defines + (shaderSources[name] || '');

        // remove attributes for fragment shader
        var commonFragment = _.reject(common.split('\n'), function(line) {
                return line.match(/attribute/);
            }).join('\n');

        try {
            var program = new Program(name);
            program.set_program(createProgram({
                name: name,
                vertexSource: common + shaderSources[name+'.vertex'],
                fragmentSource: commonFragment + shaderSources[name+'.fragment'],
            }));

            return program;
        }
        catch (error) {
            //onGLSLError(error);
            return null;
        }
    }

    function hashProgram(name, options) {
        var defs = [];
        if (options && options.defines) {
            _.each(options.defines, function(dv, dk) {
                defs.push(dk+'='+dv);
            });
        }

        return name+' '+defs.join(' ');
    }

    return _.memoize(makeProgram, hashProgram);
})();

export function new_buffer(target, data, usage) {
    usage = usage || gl.STATIC_DRAW;
    var buffer = gl.createBuffer();
    gl.bindBuffer(target, buffer);
    gl.bufferData(target, data, usage);
    return buffer;
}

export function new_vertex_buffer(arr, usage) {
    return new_buffer(gl.ARRAY_BUFFER, arr, usage);
}

export function new_element_buffer(arr, usage) {
    return new_buffer(gl.ELEMENT_ARRAY_BUFFER, arr, usage);
}

export function bind_vertex_buffer(buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
}

export function bind_element_buffer(buffer) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
}

export var extensions = {};

export function setup_canvas(canvas, options) {
    options = options || {};
    options = _.defaults(options, {
        antialias: false,
        preserveDrawingBuffer: true,
        extensions: [],
        shaderSources: []
    });

    function tryContext(type) {
        try {
            return canvas.getContext(type, options);
        }
        catch (e) {
            // XXX return the exception?
            return null;
        }
    }

    var gl = tryContext('webgl') || tryContext('experimental-webgl');
    if (gl) {
        extensions = {};
        _.each(options.extensions, function(name) {
            extensions[name] = gl.getExtension(name);
        });

        window.gl = gl;

        // load the shaders
        fetchShaderSources(options.shaderSources);
    }

    return gl;
}

export function new_texture(options) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    options = options || {};
    options.width = options.width || options.size || 4;
    options.height = options.height || options.width;
    options.format = options.format || gl.RGBA;
    options.type = options.type || gl.UNSIGNED_BYTE;
    options.mag = options.mag || options.filter || gl.NEAREST;
    options.min = options.min || options.mag;

    options.wrapS = options.wrapS || options.wrap || gl.CLAMP_TO_EDGE;
    options.wrapT = options.wrapT || options.wrapS;

    options.dataFormat = options.dataFormat || options.format;
    options.data = options.data || null;

    var level = 0;
    var border = 0;

    gl.texImage2D(gl.TEXTURE_2D, level, options.format,
                  options.width, options.height, border,
                  options.dataFormat, options.type, options.data);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.min);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, options.mag);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, options.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, options.wrapT);

    if (options.aniso) {
        var ext = extensions.EXT_texture_filter_anisotropic;
        ext && gl.texParameteri(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, options.aniso);
    }

    return texture;
}

export function load_texture(url, options) {
    options = options || {};
    options = _.defaults(options, {
        mipmap: false,
        flip: false,
        callback: null,
        filter: gl.LINEAR,
    });

    var texture = new_texture(options);

    var image = new Image();
    if (options.cors) image.crossOrigin = 'anonymous';
    image.src = url;
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, options.flip ? 1 : 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        if (options.mipmap) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.generateMipmap(gl.TEXTURE_2D);
        }

        if (options.callback)
            options.callback(texture);
    };

    return texture;
}

export function check_webgl(options) {
    try {
        var c = document.createElement('canvas');
        var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        if (!gl)
            return false;

        // webgl version
        var version = (function() {
            var v = gl.getParameter(gl.VERSION);
            var m = v.match(/^WebGL ((\d+)\.(\d+))/);
            return m ? parseFloat(m[1]) : 0.0;
        }());

        if (version < 0.96) {
            // IE11: 0.94
            // Edge: 0.96
            // Chrome, Safari, Firefox: 1.0
            return false;
        }

        var supported_extensions = gl.getSupportedExtensions();
        var ok = true;

        // mandatory extensions
        if (options && options.extensions) {
            ok = ok && check_extensions(options.extensions);
        }

        return ok;
    } catch (e) {
        return false;
    }

    function check_extensions(extensions) {
        for (var i = 0; i < extensions.length; ++i)
            if (supported_extensions.indexOf(extensions[i]) < 0)
                return false;
        return true;
    }
}
