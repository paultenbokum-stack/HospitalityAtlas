# Hospitality Atlas V5.2.0 - Clean Rebuild

This version is rebuilt from the last known-good Greater Ballito interaction model instead of continuing the V5.1.x patch chain.

Key changes:
- persistent activity/progress strip: it is never removed at 100%;
- prospect list is a permanent grid row with minmax(0,1fr);
- national preset + custom South Africa viewport discovery retained;
- Notes autosave does not re-render the active editor;
- shared CRM repository abstraction retained;
- existing saved prospect references are loaded from the same local repository keys;
- local API key storage key is retained, so the previously saved development key should auto-load.

Test sequence:
1. Run START_V5_2_0_LOCAL.bat.
2. Run Quick Scan in Greater Ballito.
3. Let activity reach 100%; it remains visible as Scan complete.
4. Confirm prospect cards remain visible.
5. Repeat with Johannesburg/Cape Town.
