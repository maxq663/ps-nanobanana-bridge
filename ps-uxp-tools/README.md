# Nanobanan Layer Bridge

Photoshop 2026+ UXP panel plugin for sending the selected layer to an AI image API and importing the processed result back into the PSD.

## Target

- Host: Adobe Photoshop
- Minimum version: Photoshop 2026 / 27.0.0
- Plugin type: UXP manifest v5 panel

## Workflow

1. Select exactly one layer in Photoshop.
2. Open **Plugins > Nanobanan**.
3. Enter the forwarding API URL and API key.
4. Click **检测连接** to verify the API address and key.
5. Click **Process Selected Layer**.

## Connection Test

The panel saves the API URL, API Key, and auth mode, then checks:

`GET <API origin>/v1/models`

For example, `https://ai.comfly.org/v1/images/edits` is tested as:

`https://ai.comfly.org/v1/models`

HTTP 200 means the connection and key are valid. HTTP 401/403 means the key is invalid or unauthorized.

The plugin exports the selected layer as a transparent PNG, sends it as multipart form data, then imports the returned image as a new layer aligned to the original layer bounds.

Default API URL:

`https://ai.comfly.org/v1/images/edits`

If the panel contains only a host such as `https://ai.comfly.org`, the plugin automatically expands it to `/v1/images/edits`.

## Default API Request

`POST <API URL>` with `multipart/form-data`:

- `image`: exported PNG file
- `prompt`: panel prompt text
- `model`: defaults to `nanobanan`
- `metadata`: JSON with layer bounds and document info
- Extra JSON fields from the panel are appended as additional form fields

Auth modes:

- `Authorization: Bearer <key>`
- `x-api-key: <key>`
- `api-key: <key>`
- none

Supported responses:

- Direct image response: `image/png`, `image/jpeg`, or `image/webp`
- JSON with common fields such as `b64_json`, `image_base64`, `image`, `url`, `image_url`, `data[0].b64_json`, or `data[0].url`

## Development Load

Use Adobe UXP Developer Tool:

1. Click **Add Plugin**.
2. Select the `ps-uxp-tools` folder.
3. Click **Load**.

## Distribution

Photoshop UXP plugins are normally distributed as `.ccx` packages. Use UXP Developer Tool **Package** to create a double-click installer for end users.

If the API host is fixed, replace `"domains": "all"` in `manifest.json` with the exact API origin before packaging.
