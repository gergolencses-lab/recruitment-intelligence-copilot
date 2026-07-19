// Vercel serverless belépési pont.
// A teljes Express-appot futtatja handlerként (a static UI + a Capability API
// egy helyről szolgál ki). A titkos kulcsok a Vercel env-változóiból jönnek.
import app from "../app/server.js";
export default app;
