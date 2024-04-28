# API Usage

The API is available to use for retrieving gear sheets and sets.

## Simple Set Retrieval

When you have a link such
as [https://share.xivgear.app/share/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf](https://share.xivgear.app/share/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf),
or the
equivalent [https://xivgear.app/#/sl/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf](https://xivgear.app/#/sl/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf),
the `cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf` part is the sheet/set ID.

You can retrieve the data by
GETing [https://api.xivgear.app/shortlink/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf](https://api.xivgear.app/shortlink/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf).

The retrieved JSON data can then be interpreted according to the TSDocs. It is of type
[TopLevelExport](https://xivgear.app/docs/types/_xivgear_xivmath.geartypes.TopLevelExport.html), which then resolves to
either
[SheetExport](https://xivgear.app/docs/interfaces/_xivgear_xivmath.geartypes.SheetExport.html) or
[SetExport](https://xivgear.app/docs/interfaces/_xivgear_xivmath.geartypes.SetExport.html), representing an exported
gear planning
sheet or individual gear set, respectively.

## Detailed Set Retrieval

If you want something more equivalent to the Etro API which also returns *derived* information about a set
(e.g. computed stats of a set), rather than purely the user-specified information (like the items and materia), you can
use the `https://api.xivgear.app/fulldata/` endpoint. You should not use this if not needed, as it is significantly
slower.

To use `/fulldata/`, specify either a set UUID or a bis link, e.g.:

- [https://api.xivgear.app/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501](https://api.xivgear.app/fulldata/f9b260a9-650c-445a-b3eb-c56d8d968501) -
  equivalent
  to [https://xivgear.app/#/sl/f9b260a9-650c-445a-b3eb-c56d8d968501](https://xivgear.app/#/sl/f9b260a9-650c-445a-b3eb-c56d8d968501)
  or [https://share.xivgear.app/share/f9b260a9-650c-445a-b3eb-c56d8d968501](https://share.xivgear.app/share/f9b260a9-650c-445a-b3eb-c56d8d968501).
- [https://api.xivgear.app/fulldata/bis/sge/endwalker/anabaseios](https://api.xivgear.app/bis/sge/endwalker/anabaseios) -
- equivalent
  to [https://xivgear.app/#/bis/sge/endwalker/anabaseios](https://xivgear.app/#/bis/sge/endwalker/anabaseios).

The fulldata endpoint returns
a [SheetStatsExport](https://xivgear.app/docs/interfaces/_xivgear_xivmath.geartypes.SheetStatsExport.html)
object (even when the original data source was a single set, rather than a full sheet).

[//]: # (TODO: auto-gen some of this with https://github.com/fastify/fastify-swagger)

The fulldata endpoint accepts some URL query parameters:
- `partyBonus` - override the party bonus. Specify as a number, i.e. `?partyBonus=3`.