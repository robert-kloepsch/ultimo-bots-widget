// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/index.js',   // your main JS file
  output: {
    filename: 'bundle.js',   // the built JS will be named bundle.js
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '', // in most cases '' or './'; adjust if deploying to GitHub pages
  },
  mode: 'development', // or 'production' for a minified build
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    // 1. Generate dist/index.html from src/index.html (optional)
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    // 2. If you have a local cloud.png you want to copy
    new CopyWebpackPlugin({
      patterns: [
        { from: './src/cloud.png', to: 'cloud.png' },
      ],
    }),
  ],
};
