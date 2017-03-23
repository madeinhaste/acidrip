import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import uglify from 'rollup-plugin-uglify';
import string from 'rollup-plugin-string';

export default {
    entry: 'src/main.js',
    dest: 'dist/main.bundle.js',
    format: 'iife',
    
    plugins: [
        string({
            include: 'src/**/*.glsl'
        }),
        nodeResolve({
            //module: true,
            jsnext: false,
            main: true,
            //skip: ['xxx'],
            browser: true,
            extensions: ['.js', '.json'],
            preferBuiltins: false
        }),
        commonjs({
            include: 'node_modules/**',
            ignoreGlobal: false,
            sourceMap: true,
        }),
        babel({
            exclude: 'node_modules/**',
            presets: ['es2015-rollup']
        }),
        uglify()
    ]
};
