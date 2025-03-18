const HtmlWebpackPlugin = require("html-webpack-plugin");
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const path = require("path");
module.exports = (env, argv) => {
    const prod = argv.mode === 'production';
    return {
        entry: [path.resolve(__dirname, "./src/scripts/main.ts")],
        output: {
            path: path.resolve(__dirname + "/dist"),
            clean: false
        },
        optimization: {
            minimize: prod,
        },
        devtool: prod ? 'nosources-source-map' : 'source-map',
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
                inject: false
            })
        ],
        resolve: {
            extensions: ['.ts', '.js'],
            plugins: [
                new TsconfigPathsPlugin({
                    logLevel: "INFO",
                    references: ["../common-ui"]
                }),
            ],
        },
    }
};