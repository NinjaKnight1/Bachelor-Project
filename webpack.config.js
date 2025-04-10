const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    bundle: ['./FrontEnd/app.js', './FrontEnd/style.css'] // Ensure style.css is included here
  },
  output: {
    path: __dirname + '/public',
    filename: 'app.js'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ]
      },
      {
        test: /\.bpmn$/,
        use: 'raw-loader'
      },
      {
        test: /\.dmn$/,
        use: 'raw-loader'
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'FrontEnd/index.html', to: '.' }
      ]
    })
  ],
  mode: 'development',
  devtool: 'source-map'
};