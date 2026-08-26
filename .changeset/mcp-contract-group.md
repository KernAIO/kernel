---
'@kernhq/contracts': minor
---

New `mcp` contract group on `coreContract`: the pending-authorization, connected-client and token
procedures behind MCP consent screens and workspace admin surfaces. New exported schemas
`McpClient`, `McpTokenInfo`, `McpAuthRequestInfo` and the coarse scope shape (`<module>:read|write`).
Additive for parsing and constructing — no existing field changed.
