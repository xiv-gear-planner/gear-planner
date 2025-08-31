# API Usage

The API is available to use for retrieving gear sheets and sets.

## Set/Sheet Retrieval

Ideally, you should ask the user for a full URL (rather than a partial URL), and then use the
/fulldata or /basedata endpoint depending on your needs. /basedata returns only the "base" data, i.e. the user-specified
data such as gear items and materia. /fulldata returns the full data, including derived information such as the computed
stats.

Take your link, and plug it into the `?url=` parameter of the /basedata or /fulldata endpoint.

Example:

1. Start with `https://xivgear.app/?page=sl|f9b260a9-650c-445a-b3eb-c56d8d968501&onlySetIndex=1`
2. GET `https://api.xivgear.app/basedata?url=https%3A%2F%2Fxivgear.app%2F%3Fpage%3Dsl%7Cf9b260a9-650c-445a-b3eb-c56d8d968501%26onlySetIndex%3D1`

By using the API like this, you can future-proof your application against changes to the URL structure used by Xivgear,
of which there are existing proposals to do so, and may happen in the future.

You can also plug in URL parameters directly, or combine both styles. For example,
all of the following are equivalent:

- `https://api.xivgear.app/basedata?url=https%3A%2F%2Fxivgear.app%2F%3Fpage%3Dsl%7Cf9b260a9-650c-445a-b3eb-c56d8d968501%26onlySetIndex%3D1`
- `https://api.xivgear.app/basedata?page=sl|f9b260a9-650c-445a-b3eb-c56d8d968501&onlySetIndex=1`
- `https://api.xivgear.app/basedata?url=https%3A%2F%2Fxivgear.app%2F%3Fpage%3Dsl%7Cf9b260a9-650c-445a-b3eb-c56d8d968501%26onlySetIndex%3D2&onlySetIndex=1`

Note that if a parameter appears in both the URL and the query string, the query string parameter takes precedence. This
allows you to do things like overriding the party bonus, regardless of what was in the original URL.

Note that both basedata and fulldata endpoints return a [SheetStatsExport](https://xivgear.app/docs/interfaces/_xivgear_xivmath.geartypes.SheetStatsExport.html) object, even if the underlying data is a single-set export.

### All Parameters

The fulldata endpoint accepts some URL query parameters:
- `url` - a full URL.
- `page` - a page path.
- `partyBonus` - override the party bonus. Specify as a number, i.e. `?partyBonus=3`.