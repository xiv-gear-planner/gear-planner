const HtmlWebpackPlugin = require("html-webpack-plugin");
module.exports = {
    entry: "./src/scripts/main.ts",
    output: {
        path: __dirname + "/dist",
        clean: true
    },
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
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