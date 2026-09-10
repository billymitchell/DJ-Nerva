#!/usr/bin/env node
// The fetcher reuses and renews OAuth tokens before fetching public mixes.
require('./soundcloud_fetch').main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
