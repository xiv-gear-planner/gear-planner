# Item Level Sync Logic

When you enter a duty with an item level sync which is lower than the item level of an equipped item, that item will
be synced. The result of this is:
1. All materia installed in the item will be nullified. They will provide no stats whatsoever.
2. Each individual stat on the item - mainstats, substats, defense, weapon damage, and everything else - will have a
cap applied. If the item provides more of that stat than the cap, it will be reduced to the cap.

## The Math

Let's say you are playing Blue Mage. You are in an i270 duty, and have an i530 Edenmorn Hat of Casting equipped.
Normally, it would provide:
- 129 INT (BaseParam #4)
- 122 VIT (BP #3)
- 126 Crit (BP #27)
- 88 Det (BP #44)
- 244 Defense (BP #21)
- 427 Magic Defense (BP #24)

Let's compute the expected amount of Vitality.

Now, we need to consult a few sheets:
- The item itself: [Item #32330](https://v2.xivapi.com/api/sheet/Item/32330)  
  - In the `BaseParam` array, index 1 (starting from 0) is Vitality (BaseParam #3). Look at the corresponding index in
    `BaseParamValue` - it is **122**, which is how much VIT the item would provide if not synced.
  - Make note of the `BaseParamModifier` value of **5** as well. This value typically corresponds with the intended
    job/role of the item (e.g. casting, striking, DoL).
- The Vitality `BaseParam`: [BaseParam #3](https://v2.xivapi.com/api/sheet/BaseParam/3)
  - Look at the `MeldParam` array - index #5 has a value of **90**.
  - Since this item goes in the head slot, look at `HeadPercent` which is **85**.
- Finally, look at the Item Level: [ItemLevel #270](https://v2.xivapi.com/api/sheet/ItemLevel/270)
  - `Vitality` is **736**.

With that done, we take all of that and plug it into `xivmath.ts`'s `statCapWithJob` function. Note that this is not
directly taken from game code - it is likely that the actual formula only exists server-side. This formula is instead
derived from testing, so may not be the actual formula.

```ts
round(floor(floor(ilvlModifier * meldParam / 100) * baseParamModifierSlotModifier / 100) / 10);
```

Plugging in the values, this becomes:
```ts
round(floor(floor(736 * 90 / 100) * 85 / 100) / 10);
round(floor(floor(662.4) * 85 / 100) / 10);
round(floor(662 * 85 / 100) / 10);
round(floor(562.7) / 10);
round(562 / 10);
round(56.2);
56
```

This gives us our final value of 56.

## Implications

You would likely assume that a downsynced item would have stat caps equivalent to an item of the level to which it
is downsynced. This is not necessarily true. Normally, an item's BaseParamModifier (MeldParam index) will correspond
to its intended class/job in such a way that you get a 100% modifier for all stats relevant to that job. For example,
Fending has an index of 1, and has 100% for Vitality and Strength, while having only 70 for Dex/Int/Mind. Thus, the
assumption holds true for this item, with two notable exceptions:
- some early items (ARR mostly) seem to have much more "freeform" stats
- since item stats don't necessarily follow this formula exactly, you get a few situations where the expected 
  vitality is off-by-one.

However, where this assumption really breaks is for items that are not locked to a specific class or job. These
typically use index 0 of MeldParam, which provides 90 to all mainstats. This means that such an item would effectively
exhibit a 10% VIT and STR penalty compared to both an item of exactly the item sync level or to a downsynced fending
item.

## Misc

### Item Base Stats

Most stats are in the BaseParam + BaseParamValue arrays. However, some are in flat fields item itself, such
as defense (DefenseMag/DefensePhys), weapon damage (DamageMag/DamagePhys), weapon speed (Delayms), and block.

Furthermore, you may also need to add the stats from BaseParamSpecial and BaseParamValueSpecial. They work the same as
BaseParam and BaseParamValue, but are conditional in some manner. The condition can be, among other things:
- HQ versions of craftable items
- Special area effects (Eureka, Bozja, etc)
- Set bonuses
Sometimes, the `ItemSpecialBonus` field will tell you more about what condition activates the special bonus.

Unlike BaseParam, BaseParamSpecial will contain bonuses to stats which would otherwise be expressed as the 
aforementioned flat fields, such as defense and weapon damage.

### Class-Based Stats

When dealing with stats such as pre-order earrings and Bozja earrings which provide "Main Attribute" and/or 
"Secondary Attribute", these should be resolved to their actual stat based on the wearer's job first, and then
the cap calculated as if it were that stat. For example, Healers have a "secondary attribute" of piety, so you would
resolve "secondary attribute" -> "piety" first, and then calculate the cap as if the item grants piety the normal way.

