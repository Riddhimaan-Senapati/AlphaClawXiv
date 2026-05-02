## Summary

Describe what changed and why.

## Type of Change

- [ ] Bug fix
- [ ] Feature
- [ ] Documentation
- [ ] Refactor
- [ ] Release / packaging

## Verification

- [ ] `node --check ./plugins/alphaclawxiv/dist/index.js`
- [ ] `openclaw alphaclawxiv paper search "retrieval augmented generation"`
- [ ] `openclaw gateway status`
- [ ] `openclaw gateway health`
- [ ] `npm pack --dry-run` when package contents changed
- [ ] `clawhub package publish ./plugins/alphaclawxiv --dry-run --family code-plugin` when ClawHub metadata changed

## Security Checklist

- [ ] No tokens, auth headers, `.env` contents, or OAuth files are included.
- [ ] No startup-time network call was added.
- [ ] No automatic generic `mcp.servers.alphaxiv` install was added.

## Notes for Reviewers

Call out compatibility risks, migration notes, or known limitations.
