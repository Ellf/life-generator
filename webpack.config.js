const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        bundle: path.resolve(__dirname, 'src/index.js'),
    },
    devtool: 'inline-source-map',
    devServer: {
        static: './dist',
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Evolution Idea for Game',
            filename: 'index.html',
            template: 'src/template.html'
        }),
    ],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        clean: true,
    },
    module: {
        rules: [{
            test :/\.css$/i,
            use: ['style-loader', 'css-loader']
        }],
    },
    optimization: {
        runtimeChunk: 'single',
    },
};