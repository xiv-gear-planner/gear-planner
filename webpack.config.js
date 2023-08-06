const HtmlWebpackPlugin = require("html-webpack-plugin");
module.exports = {
    entry: ["./src/scripts/main.ts"],
    output: {
        path: __dirname + "/dist",
        clean: false
    },
    optimization: {
        minimize: false,

    },
    devtool: 'inline-source-map',
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