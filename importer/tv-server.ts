import Koa from "koa";
import KoaRouter from "koa-router";
import { fetchXmltvSchedule, REFRESH_DELAY_IN_MILLIS, XmltvBroadcast, XmltvSchedule } from "./src/xmltv";

// Schedule refresh cron

let schedule: XmltvSchedule;

async function refreshSchedule(): Promise<any> {
  schedule = await fetchXmltvSchedule();
  console.log("Broadcasts updated");
}

refreshSchedule();
setInterval(refreshSchedule, REFRESH_DELAY_IN_MILLIS);

// HTTP server

const router = new KoaRouter();
router.get("/", (ctx: Koa.Context) => {
  const response = schedule || { error: 'not-initialized' };
  if (ctx.query.callback) {
    ctx.body = `${ctx.query.callback.toString()}(${JSON.stringify(response, null, 2)});`;
  } else {
    ctx.body = response;
  }
});

const serverPort = process.env.PORT || 8080;
const server = new Koa();
server.use(router.routes());
server.listen(serverPort, () => {
  console.log(`Listening on port ${serverPort}`);
});