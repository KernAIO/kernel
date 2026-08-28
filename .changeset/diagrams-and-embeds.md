---
'@kernhq/ui': minor
---

Diagram and embed nodes, and a Mermaid renderer that runs on the server.

`diagram` holds its **source** rather than a picture — Mermaid, Excalidraw or Draw.io — which is
what lets a page carry a diagram through an export, a published site and a print without any of them
needing the editor. `renderMermaid` draws it outside the browser; the other two keep their stored
image and fall back to a link, and a source that will not parse shows the source and the error
rather than a blank block.

`embed` holds a URL and the fields an unfurl fills. It stores nothing it did not fetch, and the
fetching lives in the module, where the allowlist is.
