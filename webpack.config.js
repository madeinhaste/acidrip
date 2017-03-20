var path = require('path');

module.exports = {
    context: __dirname + '/src',
    entry: {
        main: './main.js',
        //mom_main: './mom-main.js',
    },
    output: {
        path: __dirname + '/dist',
        filename: '[name].bundle.js',
        publicPath: '/assets/',
    },
    module: {
        rules:[
            //{ test: /\.css$/, use: ['style-loader', 'css-loader'] },
            //{ test: /\.(sass|scss)$/, use: ['style-loader', 'css-loader', 'sass-loader'] },
            {
                test: /\.js$/,
                include: path.join(__dirname, 'src'),
                loader: 'babel-loader',
                query: {
                    presets: [
                        'es2015'
                    ]
                }
            }
        ],
    },
    devtool: 'eval-source-map',
    devServer: {
        contentBase: [
            __dirname + '/static',
        ],
        host: '0.0.0.0',
        port: 8000
    },
    performance: {
        hints: false,
    },
};
