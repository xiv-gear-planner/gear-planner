const HtmlWebpackPlugin = require("html-webpack-plugin");
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const path = require("path");
const BeastiesWebpackPlugin = require("beasties-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
module.exports = (env, argv) => {
    const prod = argv.mode === 'production';
    return {
        entry: {
            // It is not necessary to declare the webworker as an entry point, since we are using the syntax that
            // webpack automatically recognizes and turns into a chunk.
            main: path.resolve(__dirname, "./src/scripts/main.ts"),
        },
        output: {
            path: path.resolve(__dirname + "/dist"),
            clean: false,
            filename: prod ? '[name].[contenthash].js' : '[name].js',
            // Normally, webpack tries to guess the public URL of the output files, but the way it does so will break
            // if you have 3rd party scripts (cloudflare beacon, etc) on the page. This tells it that the scripts are
            // always in the same directory as the HTML document.
            publicPath: '/',
        },
        optimization: {
            // Minimize for the 'npm run buildprod' mode but not the normal 'npm run build'.
            minimize: prod,
            chunkIds: 'named',
            splitChunks: false,
        },
        // devtool: prod ? 'nosources-source-map' : 'source-map',
        devtool: 'source-map',
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: {
                        loader: 'ts-loader',
                        options: {
                            projectReferences: true
                        },
                    },
                    exclude: /node_modules/,
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, "src/index.html"),
                filename: "index.html",
                inject: 'head',
                scriptLoading: 'module'
            }),
            new NodePolyfillPlugin(),
            new BeastiesWebpackPlugin({
                preload: false,
                path: './dist/',
                publicPath: '',
                logLevel: 'debug',
                includeSelectors: ['body.light-mode']
            })
        ],
        resolve: {
            extensions: ['.ts', '.js'],
            fallback: {
                "util": false,
                "http": false,
                "fs": false,
                "canvas": false,
                "net": false,
                "tls": false,
                "child_process": false,
                "path": false,
                "os": false,
            },
            plugins: [
                new TsconfigPathsPlugin({
                    logLevel: "INFO",
                    references: [
                        "../common-ui",
                        "../core",
                        "../util",
                        "../xivmath",
                    ]
                }),
            ],
        },
        devServer: {
            static: "./dist",
            port: 8076,
            client: {
                overlay: false
            }
        }
    }
};