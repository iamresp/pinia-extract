const TerserPlugin = require("terser-webpack-plugin");

const camelcase = require("camelcase");
const nodeExternals = require("webpack-node-externals");

const isProduction = process.env.NODE_ENV === "production";

module.exports = {
    stats: "errors-only",
    entry: "./src/index.ts",
    devtool: isProduction
        ? undefined
        : "source-map",
    mode: "production",
    externalsPresets: {
        node: true,
    },
    externals: [
        nodeExternals({
            importType: (moduleName) => (
                `iife ${camelcase(moduleName, {pascalCase: true})}`
            ),
        }),
    ],
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: "babel-loader",
            },
        ],
    },
    output: {
        filename: isProduction
            ? "pinia-extract.min.js"
            : "pinia-extract.js",
        iife: true,
        library: {
            name: "PiniaExtract",
            type: "var",
        },
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    optimization: {
        minimize: isProduction,
        minimizer: [
            new TerserPlugin({
                parallel: true,
                terserOptions: {
                    mangle: {
                        keep_fnames: true,
                    },
                    output: {
                        comments: false,
                    },
                },
            }),
        ],
        usedExports: true,
    },
};
