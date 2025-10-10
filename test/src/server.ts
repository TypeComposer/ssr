import { Engine } from "typecomposer-ssr";

const server = Engine.createServer("src/template");

server.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
