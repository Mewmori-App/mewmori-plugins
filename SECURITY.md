# Security policy

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose user data, credentials, or local files. Use GitHub's **Report a vulnerability** flow for this repository. Include the affected plugin ID and version, impact, reproduction steps, and a minimal proof of concept that contains no real user data.

## Security model

Plugins run as separate Node.js processes, but they are not operating-system sandboxes. Manifest permissions are a review and consent mechanism, not a technical boundary around filesystem or process access.

Catalog review and automated validation reduce obvious risk but do not guarantee that a plugin is safe. Users should inspect source code and install only plugins they trust.

Plugin authors must:

- use official service APIs and comply with their terms;
- minimize data collection and retention;
- store secrets only through Mewmori's secret settings;
- never include secrets in logs, activities, screenshots, fixtures, or tests;
- pin dependencies and promptly address security advisories;
- document all network hosts and destructive or outbound actions;
- require explicit user confirmation for sending, publishing, paying, deleting, or submitting data.
