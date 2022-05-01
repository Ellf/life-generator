const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin; 

module.exports = {
    mode: 'development',
    entry: {
        simulator: path.resolve(__dirname, 'src/simulator.js'),
        bundle: path.resolve(__dirname, 'src/index.js'),
    },
    devtool: 'inline-source-map',
    devServer: {
        static: {
            directory: path.resolve(__dirname, './dist')
        },
        port: 3000,
        open: true,
        hot: true,
        compress: true,
        historyApiFallback: true,
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Evolution Idea for Game',
            filename: 'index.html',
            template: 'src/template.html'
        }),
        // new BundleAnalyzerPlugin(),
    ],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].[contenthash].js',
        clean: true, 
    },
    module: {
        rules: [{
            test :/\.css$/i,
            use: ['style-loader', 'css-loader']
        }],
    },
    optimization: {
        splitChunks: {
            chunks: 'all'
        }
    },
};