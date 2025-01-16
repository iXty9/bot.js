const path = require('path');
const Dotenv = require('dotenv-webpack');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'src/public'),
    filename: 'bundle.js',
    publicPath: '/'
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx']
  },
  plugins: [
    new Dotenv()
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'src/public'),
    },
    compress: true,
    port: 3000,
    hot: true,
    proxy: {
      '/api': {
        target: 'http://localhost:6987',
        secure: false,
        changeOrigin: true
      }
    },
    historyApiFallback: true
  }
};
