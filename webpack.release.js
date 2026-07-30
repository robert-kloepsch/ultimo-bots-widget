// Release build: the versioned, SRI-pinned artifact served from
// widget.ultimo-bots.com (registered with Webflow via the Custom Code API).
// The default webpack.config.js (dist/bundle.js, the legacy GitHub Pages
// path every existing embed loads) is deliberately untouched — build that
// separately and only when a global rollout is intended.
//
// Output: release/<package.json version>/ultimo-widget.js
// The version in the path IS the immutable release id — never overwrite a
// published version directory; bump package.json instead.
const path = require('path');
const pkg = require('./package.json');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'ultimo-widget.js',
    path: path.resolve(__dirname, 'release', pkg.version),
    clean: true,
    publicPath: '',
  },
  mode: 'production',
  devtool: false,
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
};
