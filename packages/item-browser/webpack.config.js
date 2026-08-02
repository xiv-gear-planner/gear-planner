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
            // Don't minimize the math stuff, formulae won't be readable
            minimize: false,
        },
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
        plugins: [],
        resolve: {
            extensions: ['.ts', '.js'],
            plugins: [
                new TsconfigPathsPlugin({
                    logLevel: "INFO",
                }),
            ],
        },
    }
};
