const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
 
module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  mode: 'development',
  devtool: 'source-map',
  devServer: {
    static: './dist',
    hot: true,
    port: 3000,
    historyApiFallback: true,
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
        exclude: [
          /node_modules\/d3-selection/,
          /node_modules\/d3-zoom/,
          /node_modules\/d3-drag/,
          /node_modules\/@reactflow/,
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
  ],
};
 
 
import * as d3 from 'd3-selection';
 
// Polyfill .interrupt and .transition if missing
if (typeof d3.selection.prototype.interrupt !== 'function') {
  d3.selection.prototype.interrupt = () => {};
}
 
if (typeof d3.selection.prototype.transition !== 'function') {
  d3.selection.prototype.transition = function () {
    return this;
  };
}
 
 