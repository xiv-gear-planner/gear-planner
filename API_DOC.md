# API Usage

The API is available to use for retrieving gear sheets and sets.

When you have a link such as [https://share.xivgear.app/share/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf](https://share.xivgear.app/share/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf),
or the equivalent [https://xivgear.app/#/sl/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf](https://xivgear.app/#/sl/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf),
the `cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf` part is the sheet/set ID.

You can retrieve the data by GETing [https://api.xivgear.app/shortlink/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf](https://api.xivgear.app/shortlink/cd2c8bf4-1fa2-4197-88f5-f305b9a93bdf).

The retrieved JSON data can then be interpreted according to the TSDocs. It is of type 
[TopLevelExport](https://xivgear.app/docs/types/_xivgear_xivmath.geartypes.TopLevelExport.html), which then resolves to either
[SheetExport](https://xivgear.app/docs/interfaces/_xivgear_xivmath.geartypes.SheetExport.html) or
[SetExport](https://xivgear.app/docs/interfaces/_xivgear_xivmath.geartypes.SetExport.html), representing an exported gear planning
sheet or individual gear set, respectively.