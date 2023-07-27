module.exports = {
    entry: "./src/scripts/main.ts",
    output: {
        path: __dirname + "/dist",
        filename: "bundle.js"
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
    resolve: {
        extensions: ['.ts', '.js'],
        // modules: ['build', 'node_modules']
        // modules: ['build', 'node_modules']
    }
}