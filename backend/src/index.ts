import { app } from "./app";
import { env } from "./lib/env";

const port = Number(env.PORT);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
