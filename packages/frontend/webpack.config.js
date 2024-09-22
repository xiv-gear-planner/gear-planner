const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
module.exports = (env, argv) => {
    const prod = argv.mode === 'production';
    return {
        entry: [path.resolve(__dirname, "./src/scripts/main.ts"),
                path.resolve(__dirname, "./src/scripts/components/meld_solver_worker.ts")
        ],
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
                            "projectReferences": true
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