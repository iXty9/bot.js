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
    host: '0.0.0.0',
    hot: true,
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: 'http://0.0.0.0:6987',
        secure: false,
        changeOrigin: true,
        onError: (err, req, res) => {
          console.error('Proxy error:', err);
          res.writeHead(500, {
            'Content-Type': 'text/plain',
          });
          res.end('Proxy error: ' + err.message);
        }
      }
    },
    historyApiFallback: true,
    onListening: function(devServer) {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }
      console.log('Webpack dev server listening on port:', devServer.server.address().port);
    }
  }
};
