const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    bundle: ['./FrontEnd/app.js', './FrontEnd/CSS/style.css'] // Ensure style.css is included here
  },
  output: {
    path: __dirname + '/public',
    filename: 'app.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
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
        { from: 'FrontEnd/index.html', to: '.' },
        { from: 'resources', to: 'resources' },
        { from: 'Diagrams', to: 'Diagrams' }
      ]
    })
  ],
  mode: 'development',
  devtool: 'source-map'
};