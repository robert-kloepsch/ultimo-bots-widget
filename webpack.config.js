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
  // Minified. dist/bundle.js is what every non-Webflow customer downloads on
  // every page view, so the unminified build was pure cost. Same setting as
  // webpack.release.js, whose output already runs in production on Webflow.
  // Trade-off: no source maps, so a browser stack trace shows minified names.
  // Rebuild locally with mode:'development' when you need to debug one.
  mode: 'production',
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
