const HtmlWebpackPlugin = require("html-webpack-plugin");
module.exports = (env, argv) => {
    const prod = argv.mode === 'production';
    return {
        entry: ["./src/scripts/main.ts"],
        output: {
            path: __dirname + "/dist",
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
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                // {
                //     test: /\.less$/,
                //     use: [
                //         'style-loader',
                //         'css-loader',
                //         'less-loader'
                //     ]
                // }
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: "src/index.html",
                filename: "index.html",
                inject: false
            })
        ],
        resolve: {
            extensions: ['.ts', '.js'],
            // modules: ['build', 'node_modules']
            // modules: ['build', 'node_modules']
        }
    }
}