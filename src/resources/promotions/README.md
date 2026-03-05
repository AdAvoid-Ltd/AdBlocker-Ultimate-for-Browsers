# Promotional Assets

This directory contains promotional assets and configurations for various sales and promotions.

## Structure

All promotions are defined in a centralized `config.json` file, with assets stored directly in individual promotion folders:

```
src/resources/promotions/
  config.json            # Centralized promotion configurations (JSON array)
  {promo-id}/
    background.png       # Background image (filename must match config.json)
    icon.png             # Icon image (filename must match config.json)
    ...
```

## Adding a New Promotion

1. Add the promotion configuration to `src/resources/promotions/config.json` (add to the array)
2. Create a new directory: `src/resources/promotions/{promo-id}/`
3. Add your promotional image files directly in that folder
4. Ensure asset filenames in `config.json` match the actual filenames
5. Build with: `pnpm run release:promo -- --promo={promo-id}`

## Config.json Format

The `config.json` file must be an **array** of promotion objects. Each promotion object must contain the following fields:

```json
[
  {
    "id": "promo-id",
    "nameKey": "promo_name_key",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "buttonTextKey": "promo_button_key",
    "linkUrl": "https://example.com/upgrade",
    "backgroundImage": "background.png",
    "iconImage": "icon.png",
    "actionIcon": "action-icon.png",
    "titleKey": "promo_title_key"
  }
]
```

You can define multiple promotions in the same array. During build, specify which promotion ID to activate using `--promo={promo-id}`.

**Important:**
- `config.json` must be an array containing all promotions
- `id` must match the folder name (`{promo-id}`) where the assets are stored
- `backgroundImage`, `iconImage`, and `actionIcon` should be just the filename (e.g., `"winter-background.png"`), not a full path
- Asset filenames in the config must exactly match the files in `src/resources/promotions/{promo-id}/` (case-sensitive)

## Example

For a holiday promotion with ID `holiday-2025`:

**Directory structure:**
```
src/resources/promotions/
  config.json
  holiday-2025/
    winter-background.png
    group-203.png
    abu-icon.png
```

**Build command:**
```bash
pnpm run release:promo -- --promo=holiday-2025
```

## Notes

- All promotion configurations are stored in `src/resources/promotions/config.json`
- Each promotion's assets are stored directly in `src/resources/promotions/{promo-id}/`
- The build process validates that all referenced assets exist
- Asset paths are automatically resolved during the build process
- Only the specified promotion's config and assets are included in the release build
