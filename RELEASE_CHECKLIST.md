# Release Checklist

## Regression Checklist

Things to check before a production release:
- Check different pages as applicable
  - Editor
    - One-column
    - Two-column
  - Viewer
      - One-column
      - Two-column
  - Embedded Viewer
  - Math
  - New sheet form
  - Saved sheet picker
- Check different UI looks
  - Dark
  - Light
  - Dark Classic
  - Light Classic
- Check different platforms
  - Firefox
  - Chrome
  - iOS (the worst offender for browser-specific issues by far)
- Ads
  - Ads are only enabled on atest and prod, they will never appear on other envs or locally
  - Ads should never appear on top of or underneath content (in terms of Z-ordering, not Y-axis)
  - Ads should not influence the page layout, i.e. you shouldn't be forced into one-column mode just to make room for ads
  - Ads should not appear on embed page

## New Feature Checklist

- Add automated tests if possible
- Check backwards compatibility: a set created before the feature was added must still function and have reasonable defaults for whatever new properties were added
  - Check with local saves
  - Check with cloud saves
  - Check that fields are appropriately included/excluded with exports (not all fields need to be part of the export)