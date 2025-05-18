/** @type {import('stylelint').Config} */
export default {
    "extends": "stylelint-config-standard-less",
    "rules": {
        "no-descending-specificity": null,
        "color-hex-length": false,
        "declaration-empty-line-before": null,
        "shorthand-property-no-redundant-values": false,
        // "shorthand-property-no-redundant-values": [true, {ignore: ["four-into-three-edge-values"]}],
        "rule-empty-line-before": null,
        "alpha-value-notation": null,
        "custom-property-empty-line-before": false,
        "property-no-vendor-prefix": null,
        "declaration-block-no-redundant-longhand-properties": false,
    }
}