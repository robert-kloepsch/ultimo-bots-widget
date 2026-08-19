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
const webpack = require('webpack');
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
  // A source map is published NEXT TO the runtime (ultimo-widget.js.map) and
  // referenced by the sourceMappingURL comment, so the executed bytes can be
  // read alongside their source (Webflow App Review Preflight: "Runtime is
  // not traceable to source"). The map is for review; it loads only when
  // devtools ask for it and is never executed.
  devtool: 'source-map',
  plugins: [
    // The hosted (Webflow) runtime must not carry host-page commerce code:
    // `false` compiles the add-to-cart / theme-cart-sync chain out entirely
    // (verify: the artifact contains no "cart/add.js", "CartCount" or
    // "shopify:cart" strings). The default dev build keeps it enabled.
    new webpack.DefinePlugin({ __ULTIMO_COMMERCE__: JSON.stringify(false) }),
  ],
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
