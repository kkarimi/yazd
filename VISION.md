# Yazd Vision

`Yazd` is the product.

It should become the local-first app people use to automate personal knowledge systems, review generated work, and publish it into tools like Obsidian, folders, and later API-backed knowledge bases.

## Ownership

Yazd owns:

- workflow definitions
- review and approval state
- publish planning
- knowledge-base plugins
- agent plugins
- user-facing automation UX

Yazd does not own source-specific sync and auth machinery.

That belongs in source runtimes such as `Gran`.

## Relationship With Gran

`Gran` should be a source/runtime:

- connect to Granola
- sync and index meetings locally
- expose events, fetch, and source artifacts

`Yazd` should consume Gran like any other source plugin.

The integration should stay universal and local-first:

- event streams
- machine-readable fetch surfaces
- optional local HTTP
- script/webhook style hooks when useful

## Product Principles

1. Keep Yazd source-agnostic.
2. Keep workflow and review concepts provider-agnostic.
3. Prefer stable local seams over deep package coupling.
4. Let source runtimes stay boring and reliable.
5. Put user-facing workflow setup and publishing UX in Yazd, not in each source connector.
