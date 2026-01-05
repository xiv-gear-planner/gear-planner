# How to Properly Embed Xivgear Content on Other Sites

Please note: this is specifically for embedding - NOT for general linking. For general linking, the recommendation
is to link to an entire sheet, to allow for easy comparison of options. If you wish to link to a specific set within
a sheet while keeping the entire sheet viewable, you can add the `&selectedIndex=n` parameter to make it default to
having that set selected (n ranges from 0).

To make embeds:

1. Open the sheet that you wish to export.
2. Use the "Export Whole Sheet" option.
3. Select the "Embed URL for Each Set" option.
4. Click "Generate".
5. You will get one URL for each set (excluding separators).
6. Open one of the URLs in your browser to make sure it works as expected.

Each URL should look something like this:
```
https://xivgear.app/?page=embed%7Csl%7C154b353b-bf04-4399-8e3c-d7da7e6e0fca&onlySetIndex=3
```

## Balance Website

To add the set to the balance website, use the `genericiframe` option and paste the entire URL.

## IV and Others

For others, use an `iframe`:

```html
<iframe title="My Set" src="https://xivgear.app/?page=embed%7Csl%7C154b353b-bf04-4399-8e3c-d7da7e6e0fca&onlySetIndex=3"></iframe>
```