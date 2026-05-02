# Data Model

`GardenProject` is the central object. It owns parameters, prompt text, the deterministic seed, and image generation history.

`ImageGeneration` records every AI attempt, including failures. Failed attempts preserve prompt text, provider, model, error code, retryability, and timestamp.

`ProjectRepository` abstracts persistence so the first implementation can use localStorage and a later implementation can move to a backend database without rewriting UI components.
