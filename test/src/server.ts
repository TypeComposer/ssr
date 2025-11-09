import { Engine } from "typecomposer-ssr";
import express from "express";


const dist = {
    DOC: "/Users/Ezequiel/Documents/TypeComposer/docs/dist",
    TEMPLATE: "/Users/Ezequiel/Documents/TypeComposer/ssr/test/src/template",
    TEST: "/Users/Ezequiel/Documents/TypeComposer/test/dist"
}

const DIST_PATH = dist.DOC;
const PORT = 3000;

async function startServer() {
  const app = express();
  const engine = new Engine(DIST_PATH, PORT);


 app.use(engine.controller.bind(engine));

  app.listen(PORT, () => {
      console.log(`✅ Servindo ${DIST_PATH} em http://localhost:${PORT}`);
  });
}

startServer();